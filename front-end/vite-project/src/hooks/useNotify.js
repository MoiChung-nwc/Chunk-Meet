import { useSnackbar } from "notistack";

/**
 * useNotify
 * Giúp hiển thị snackbar (thông báo) nhanh chóng và thống nhất trong toàn app.
 *
 * Cách dùng:
 * const notify = useNotify();
 * notify.success("Thành công!");
 * notify.error("Có lỗi xảy ra");
 */
export const useNotify = () => {
  const { enqueueSnackbar } = useSnackbar();

  const baseOptions = {
    autoHideDuration: 3000,
    anchorOrigin: { vertical: "top", horizontal: "right" },
  };

  const success = (message, options = {}) =>
    enqueueSnackbar(message, { variant: "success", ...baseOptions, ...options });

  const error = (message, options = {}) =>
    enqueueSnackbar(message, { variant: "error", ...baseOptions, ...options });

  const warning = (message, options = {}) =>
    enqueueSnackbar(message, { variant: "warning", ...baseOptions, ...options });

  const info = (message, options = {}) =>
    enqueueSnackbar(message, { variant: "info", ...baseOptions, ...options });

  const neutral = (message, options = {}) =>
    enqueueSnackbar(message, { variant: "default", ...baseOptions, ...options });

  return { success, error, warning, info, neutral };
};
