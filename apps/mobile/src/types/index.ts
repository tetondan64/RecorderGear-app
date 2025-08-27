export interface Recording {
  id: string;
  title: string;
  date: string;
  duration: string;
  size: string;
  waveform?: number[];
  isStarred?: boolean;
}

export interface LibrarySection {
  title: string;
  data: Recording[];
}

export type TabParamList = {
  record: undefined;
  library: undefined;
  chat: undefined;
  settings: undefined;
};
