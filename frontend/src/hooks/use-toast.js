import { toast as sonnerToast } from "sonner";

export function useToast() {
  return {
    toast: ({ title, description, variant }) =>
      sonnerToast(title || description || "", {
        description,
      }),
  };
}

