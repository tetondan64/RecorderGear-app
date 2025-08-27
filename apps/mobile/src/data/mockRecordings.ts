import { Recording, LibrarySection } from '../types';

const generateWaveform = (length: number): number[] =>
  Array.from({ length }, () => Math.random() * 100);

export const mockRecordings: Recording[] = [
  {
    id: '1',
    title: 'Meeting Notes - Q4 Planning',
    date: '2024-01-15',
    duration: '15:42',
    size: '2.3 MB',
    waveform: generateWaveform(50),
    isStarred: true,
  },
  {
    id: '2',
    title: 'Voice Memo - Project Ideas',
    date: '2024-01-14',
    duration: '8:15',
    size: '1.2 MB',
    waveform: generateWaveform(35),
    isStarred: false,
  },
  {
    id: '3',
    title: 'Interview - Sarah Johnson',
    date: '2024-01-12',
    duration: '32:18',
    size: '4.8 MB',
    waveform: generateWaveform(80),
    isStarred: true,
  },
  {
    id: '4',
    title: 'Quick Note - Grocery List',
    date: '2024-01-11',
    duration: '2:34',
    size: '0.5 MB',
    waveform: generateWaveform(15),
    isStarred: false,
  },
  {
    id: '5',
    title: 'Lecture - Advanced React Patterns',
    date: '2024-01-10',
    duration: '45:07',
    size: '6.7 MB',
    waveform: generateWaveform(100),
    isStarred: true,
  },
];

export const libraryData: LibrarySection[] = [
  {
    title: 'Recent',
    data: mockRecordings.slice(0, 3),
  },
  {
    title: 'Starred',
    data: mockRecordings.filter(r => r.isStarred),
  },
  {
    title: 'All Recordings',
    data: mockRecordings,
  },
];
