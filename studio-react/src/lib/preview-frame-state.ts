export type FrameSlot = 0 | 1;

export interface PreviewFrameState {
  activeSlot: FrameSlot;
  pendingSlot: FrameSlot | null;
  urls: [string | null, string | null];
}

export type PreviewFrameAction =
  | { type: "queue"; url: string }
  | { type: "activate"; slot: FrameSlot };

export function createPreviewFrameState(url: string): PreviewFrameState {
  return {
    activeSlot: 0,
    pendingSlot: null,
    urls: [url, null],
  };
}

export function previewFrameReducer(
  state: PreviewFrameState,
  action: PreviewFrameAction
): PreviewFrameState {
  if (action.type === "queue") {
    if (
      state.pendingSlot === null &&
      state.urls[state.activeSlot] === action.url
    ) {
      return state;
    }
    const target: FrameSlot = state.activeSlot === 0 ? 1 : 0;
    const urls: PreviewFrameState["urls"] = [...state.urls];
    urls[target] = action.url;
    return { ...state, pendingSlot: target, urls };
  }

  if (state.pendingSlot !== action.slot) return state;
  const urls: PreviewFrameState["urls"] = [...state.urls];
  urls[state.activeSlot] = null;
  return {
    activeSlot: action.slot,
    pendingSlot: null,
    urls,
  };
}
