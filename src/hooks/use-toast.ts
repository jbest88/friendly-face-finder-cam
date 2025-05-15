
import * as React from "react";
import { 
  ToastActionElement, 
  ToastProps 
} from "@/components/ui/toast";

const TOAST_LIMIT = 3; // Reduce from 100 to 3 to prevent spam
const TOAST_REMOVE_DELAY = 5000; // Reduce from 1000000 to 5000 ms (5 seconds)

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

// Track displayed toast IDs to prevent duplicates
const displayedToastIds = new Set<string>();
// Max number of tracked IDs to prevent memory leaks
const MAX_TRACKED_TOASTS = 100;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    displayedToastIds.delete(toastId); // Clean up tracking
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: ((action: Action) => void)[] = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(action);
  });
}

type Toast = Omit<ToasterToast, "id">;

// Helper to generate a unique key for a toast message
const getToastKey = (props: Toast): string => {
  const { title, description } = props;
  return `${title}:${description}`;
};

// Clean up old tracked toast IDs if we exceed the maximum
const cleanupTrackedToasts = () => {
  if (displayedToastIds.size > MAX_TRACKED_TOASTS) {
    // Just reset the whole set if we hit the limit
    displayedToastIds.clear();
  }
};

function toast({ ...props }: Toast) {
  const id = genId();

  // Check for duplicate toasts (same title and description)
  const toastKey = getToastKey(props);
  if (displayedToastIds.has(toastKey)) {
    console.log('Preventing duplicate toast:', toastKey);
    return {
      id,
      dismiss: () => {},
      update: () => {},
    };
  }
  
  // Track this toast message
  displayedToastIds.add(toastKey);
  cleanupTrackedToasts();

  const update = (props: Toast) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });
    
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Fix the type issue by using a proper type cast for the listener
    const listener = (action: Action) => {
      setState((prevState) => reducer(prevState, action));
    };
    
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
