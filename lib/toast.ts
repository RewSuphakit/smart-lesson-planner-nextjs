import { toast } from 'sonner';

/**
 * Re-export sonner toast and utility presets styled for Smart Lesson Planner
 */
export { toast };

export const notify = {
  success: (message: string, description?: string) => {
    return toast.success(message, { description });
  },
  error: (message: string, description?: string) => {
    return toast.error(message, { description });
  },
  info: (message: string, description?: string) => {
    return toast.info(message, { description });
  },
  warning: (message: string, description?: string) => {
    return toast.warning(message, { description });
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },
};

export default toast;
