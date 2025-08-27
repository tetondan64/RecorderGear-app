import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecordTimer } from '../../record/RecordTimer';

describe('RecordTimer', () => {
  it('should render timer with formatted duration', () => {
    render(<RecordTimer duration={90} isRecording={false} />);

    expect(screen.getByText('01:30')).toBeTruthy();
  });

  it('should format single digit seconds with leading zero', () => {
    render(<RecordTimer duration={5} isRecording={false} />);

    expect(screen.getByText('00:05')).toBeTruthy();
  });

  it('should format single digit minutes with leading zero', () => {
    render(<RecordTimer duration={65} isRecording={false} />);

    expect(screen.getByText('01:05')).toBeTruthy();
  });

  it('should handle zero duration', () => {
    render(<RecordTimer duration={0} isRecording={false} />);

    expect(screen.getByText('00:00')).toBeTruthy();
  });

  it('should handle large durations', () => {
    render(<RecordTimer duration={3665} isRecording={false} />);

    expect(screen.getByText('61:05')).toBeTruthy();
  });

  it('should apply recording style when recording', () => {
    render(<RecordTimer duration={30} isRecording={true} />);

    const timer = screen.getByText('00:30');
    expect(timer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#ff4444',
        }),
      ])
    );
  });

  it('should apply normal style when not recording', () => {
    render(<RecordTimer duration={30} isRecording={false} />);

    const timer = screen.getByText('00:30');
    expect(timer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#333',
        }),
      ])
    );
  });

  it('should show waveform when recording', () => {
    render(<RecordTimer duration={30} isRecording={true} />);

    // Should render 5 waveform bars
    const waveformContainer = screen.getByTestId('waveform-container');
    expect(waveformContainer).toBeTruthy();
  });

  it('should not show waveform when not recording', () => {
    render(<RecordTimer duration={30} isRecording={false} />);

    // Waveform should not be present
    expect(screen.queryByTestId('waveform-container')).toBeNull();
  });

  it('should render monospace font family', () => {
    render(<RecordTimer duration={30} isRecording={false} />);

    const timer = screen.getByText('00:30');
    expect(timer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: 'monospace',
        }),
      ])
    );
  });

  it('should render with correct font weight and size', () => {
    render(<RecordTimer duration={30} isRecording={false} />);

    const timer = screen.getByText('00:30');
    expect(timer.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 48,
          fontWeight: 'bold',
        }),
      ])
    );
  });
});