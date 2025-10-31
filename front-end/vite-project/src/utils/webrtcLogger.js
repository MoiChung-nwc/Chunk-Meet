/**
 * ✅ WebRTC Debug Timeline Utility
 * -------------------------------------
 * Dùng để log toàn bộ tiến trình WebRTC theo timeline rõ ràng.
 * Ghi nhận từng sự kiện, timestamp, chi tiết và bên thực hiện.
 */

class WebRTCLogger {
  constructor(context = "Peer") {
    this.context = context;
    this.events = [];
    this.startTime = Date.now();
  }

  /**
   * 🕒 Ghi log có timestamp tương đối
   */
  log(event, detail = "") {
    const ts = Date.now() - this.startTime;
    const entry = { t: ts, event, detail };
    this.events.push(entry);

    const color =
      event.includes("offer") || event.includes("answer")
        ? "color: #4CAF50"
        : event.includes("candidate")
        ? "color: #00BCD4"
        : event.includes("error")
        ? "color: red"
        : "color: #888";

    console.log(
      `%c[${this.context}] ⏱ +${ts}ms | ${event} ${detail ? "→ " + detail : ""}`,
      color
    );
  }

  /**
   * 🧾 Xuất toàn bộ log ra console dạng bảng
   */
  dump() {
    console.table(this.events.map((e) => ({
      "+ms": e.t,
      Event: e.event,
      Detail: e.detail,
    })));
  }

  /**
   * 🔄 Reset timeline
   */
  reset() {
    this.events = [];
    this.startTime = Date.now();
  }
}

export default WebRTCLogger;
