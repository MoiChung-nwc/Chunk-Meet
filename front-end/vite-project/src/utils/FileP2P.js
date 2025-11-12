import { wsFileManager, wsMeetingManager } from "./WebSocketManager";

export class FileP2PManager {
  constructor({ userEmail, peersRef, wsManager = wsFileManager, getPcByEmail, onIncomingFileOffer }) {
    this.userEmail = userEmail;
    this.peersRef = peersRef;
    this.ws = wsManager;
    this.getPc = getPcByEmail;
    this.fileTransfers = {}; // {peerEmail: {sending, receiving, meta}}
    this.onIncomingFileOffer = onIncomingFileOffer;
    this.pendingFile = null;
  }

  /** 📡 Tạo DataChannel gửi file */
  createFileChannel(peerEmail) {
    const pc = this.getPc(peerEmail);
    if (!pc) {
      console.warn(`[FileP2P] ❌ No PeerConnection for ${peerEmail}`);
      return null;
    }

    // 🔹 Nếu đã có channel đang mở, dùng lại
    const existing = this.fileTransfers[peerEmail]?.sending;
    if (existing && existing.readyState === "open") {
      console.log(`[FileP2P] ♻️ Reusing existing fileChannel with ${peerEmail}`);
      return existing;
    }

    // 🔸 Nếu channel cũ đang connecting → đợi
    if (existing && existing.readyState === "connecting") {
      console.log(`[FileP2P] ⏳ Waiting for existing fileChannel to open`);
      return existing;
    }

    console.log(`[FileP2P] 📡 Creating new fileChannel with ${peerEmail}`);
    const channel = pc.createDataChannel("fileChannel");
    this._setupChannel(channel, peerEmail, true);
    this.fileTransfers[peerEmail].sending = channel;
    return channel;
  }

  /** 📥 Khi remote tạo DataChannel */
  handleIncomingChannel(peerEmail, channel) {
    console.log(`[FileP2P] 🔄 Incoming file channel from ${peerEmail}`);

    // 🛡️ Guard: nếu đã có channel đang mở → bỏ qua channel trùng
    if (
      this.fileTransfers[peerEmail]?.receiving?.readyState === "open" ||
      this.fileTransfers[peerEmail]?.sending?.readyState === "open"
    ) {
      console.warn(`[FileP2P] ⚠️ Duplicate incoming file channel from ${peerEmail} ignored`);
      channel.close();
      return;
    }

    this._setupChannel(channel, peerEmail, false);
  }

  /** 🔧 Setup DataChannel events */
  _setupChannel(channel, peerEmail, isSender) {
    if (!this.fileTransfers[peerEmail]) {
      this.fileTransfers[peerEmail] = { sending: null, receiving: [], meta: null };
    }

    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      console.log(`[FileP2P] ✅ Channel open with ${peerEmail}`);
      const transfer = this.fileTransfers[peerEmail];
      if (!transfer.sending || transfer.sending.readyState !== "open") {
        transfer.sending = channel;
      } else {
        console.warn(`[FileP2P] ⚠️ Duplicate open channel ignored`);
      }
    };

    channel.onmessage = (e) => {
      if (typeof e.data === "string") {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          console.warn("[FileP2P] ⚠️ Invalid JSON message", e.data);
          return;
        }

        // 📦 Khi nhận thông tin file
        if (msg.type === "file-info") {
          this.fileTransfers[peerEmail].receiving = [];
          this.fileTransfers[peerEmail].meta = msg.meta;
          console.log(`[FileP2P] 📦 Receiving file: ${msg.meta.name} (${msg.meta.size} bytes)`);
        }

        // 📥 Khi nhận file xong
        else if (msg.type === "file-end") {
          const { receiving, meta } = this.fileTransfers[peerEmail];
          const blob = new Blob(receiving);
          const url = URL.createObjectURL(blob);

          console.log(`[FileP2P] ✅ File received from ${peerEmail}: ${meta.name}`);

          // 🔹 Bên nhận chỉ xử lý file — KHÔNG gửi chat lại
          if (!isSender && this.onIncomingFileOffer) {
            // dùng timeout để tránh setState trong render
            setTimeout(() => {
              this.onIncomingFileOffer({
                from: peerEmail,
                meta,
                blob,
                url,
                isReceivedFile: true, // flag giúp UI biết đây chỉ là notify, không phải message chat
              });
            }, 0);
          }

          // 🔸 Dọn URL sau 1 phút
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      } else {
        // Nhận binary data
        this.fileTransfers[peerEmail].receiving.push(e.data);
      }
    };

    channel.onerror = (err) => console.error(`[FileP2P] ⚠️ Channel error:`, err);
    channel.onclose = () => console.log(`[FileP2P] ❌ Channel closed with ${peerEmail}`);
  }

  /** 📡 Gửi offer qua signaling (WebSocket) */
  sendFileOffer(to, file) {
    this.pendingFile = file;
    this.ws.send(
      {
        type: "file-offer",
        to,
        from: this.userEmail,
        meta: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
      "/ws/file"
    );
    console.log(`[FileP2P] 📨 Sent file-offer to ${to} (${file.name})`);
  }

  /** 📤 Gửi file qua DataChannel */
  async sendFile(peerEmail, file) {
    const transfer = this.fileTransfers[peerEmail];
    if (!transfer || !transfer.sending) {
      console.warn(`[FileP2P] ⚠️ No file channel open with ${peerEmail}`);
      return;
    }

    const channel = transfer.sending;

    if (channel.readyState !== "open") {
      console.warn(`[FileP2P] ⏳ Waiting for channel to open (state=${channel.readyState})`);
      await new Promise((resolve) => (channel.onopen = resolve));
    }

    console.log(`[FileP2P] 🔗 Channel open, start sending file to ${peerEmail}`);

    channel.send(JSON.stringify({ type: "file-info", meta: { name: file.name, size: file.size, type: file.type } }));
    console.log(`[FileP2P] 📤 Sending file ${file.name} (${file.size} bytes)`);

    const reader = file.stream().getReader();
    const chunkSize = 16 * 1024;
    let totalSent = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      while (channel.bufferedAmount > 4 * chunkSize) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (value.byteLength > chunkSize) {
        for (let i = 0; i < value.byteLength; i += chunkSize) {
          const slice = value.slice(i, i + chunkSize);
          channel.send(slice);
        }
      } else {
        channel.send(value);
      }

      totalSent += value.byteLength;
      if (totalSent % (512 * 1024) < chunkSize) {
        console.log(`[FileP2P] ⏩ Sent ${(totalSent / 1024).toFixed(1)} KB`);
      }
    }

    channel.send(JSON.stringify({ type: "file-end" }));
    console.log(`[FileP2P] ✅ File sent to ${peerEmail}`);

    const localBlobUrl = URL.createObjectURL(file);

    // 🟢 Chỉ sender gửi chat meeting khi file gửi thành công
    wsMeetingManager.send(
      {
        type: "meeting-chat",
        message: `📎 ${file.name}`,
        fileUrl: localBlobUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
      "/ws/meeting"
    );

    setTimeout(() => URL.revokeObjectURL(localBlobUrl), 60000);
  }

  /** 📥 Khi nhận offer gửi file từ user khác */
  handleSignalingFileOffer(msg) {
    if (msg.from === this.userEmail) {
      console.log(`[FileP2P] 🛑 Ignoring self file-offer from ${msg.from}`);
      return;
    }

    const key = `${msg.from}-${msg.meta?.name}-${msg.meta?.size}`;
    if (!this.lastOffers) this.lastOffers = new Map();
    const last = this.lastOffers.get(msg.from);
    if (last === key) {
      console.warn(`[FileP2P] ⚠️ Duplicate file-offer from ${msg.from} ignored`);
      return;
    }
    this.lastOffers.set(msg.from, key);
    setTimeout(() => this.lastOffers.delete(msg.from), 5000);

    console.log(`[FileP2P] 📥 Received file-offer from ${msg.from}`);
    this.onIncomingFileOffer?.({ from: msg.from, meta: msg.meta });
  }

  /** 📩 Khi người nhận phản hồi (accept / decline) */
  handleSignalingFileOfferResponse(msg) {
    if (msg.accept) {
      console.log(`[FileP2P] ✅ File offer accepted by ${msg.from}`);

      let channel = this.fileTransfers[msg.from]?.sending;
      if (!channel || channel.readyState === "closed") {
        channel = this.createFileChannel(msg.from);
      } else {
        console.log(`[FileP2P] ♻️ Reusing open channel with ${msg.from}`);
      }

      const sendPending = async () => {
        if (this.pendingFile) {
          await this.sendFile(msg.from, this.pendingFile);
          this.pendingFile = null;
        }
      };

      if (channel.readyState === "open") {
        console.log(`[FileP2P] 🚀 Channel already open — sending file now`);
        sendPending();
      } else {
        channel.onopen = async () => {
          console.log(`[FileP2P] 🚀 Channel opened — sending file`);
          await sendPending();
        };
      }
    } else {
      console.warn(`[FileP2P] ❌ ${msg.from} declined file offer`);
    }
  }

  async initSignaling(token) {
    if (!this._boundHandleSignalingMessage) {
      this._boundHandleSignalingMessage = this.handleSignalingMessage.bind(this);
    }
    wsFileManager.removeListener("/ws/file", this._boundHandleSignalingMessage);
    await wsFileManager.connect("/ws/file", token, this._boundHandleSignalingMessage);
  }
}
