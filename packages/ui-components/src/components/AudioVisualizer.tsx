import React, { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import { AudioVisualizerProps } from '../types';

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioData = [],
  isRecording = false,
  size = 'md',
  barCount = 12,
  className
}) => {
  const barsRef = useRef<HTMLDivElement[]>([]);

  const sizeConfig = {
    sm: { container: 'h-8', bar: 'w-1' },
    md: { container: 'h-12', bar: 'w-1.5' },
    lg: { container: 'h-16', bar: 'w-2' }
  };

  // Generate mock data when recording but no audio data provided
  const generateMockData = () => {
    return Array.from({ length: barCount }, () => Math.random() * 0.8 + 0.2);
  };

  const displayData = audioData.length > 0 ? audioData.slice(0, barCount) : 
                     isRecording ? generateMockData() : Array(barCount).fill(0.1);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        barsRef.current.forEach((bar, index) => {
          if (bar) {
            const height = (Math.random() * 0.7 + 0.3) * 100;
            bar.style.height = `${height}%`;
          }
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Reset bars when not recording
      barsRef.current.forEach((bar) => {
        if (bar) {
          bar.style.height = '20%';
        }
      });
    }
  }, [isRecording]);

  return (
    <div
      className={cn(
        'flex items-end justify-center gap-1',
        sizeConfig[size].container,
        className
      )}
      aria-label={isRecording ? 'Recording audio' : 'Audio visualizer'}
    >
      {Array.from({ length: barCount }, (_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) barsRef.current[index] = el;
          }}
          className={cn(
            'bg-blue-500 rounded-full transition-all duration-150 ease-out',
            sizeConfig[size].bar,
            isRecording ? 'animate-pulse' : ''
          )}
          style={{
            height: `${(displayData[index] || 0.1) * 100}%`,
            minHeight: '8%'
          }}
        />
      ))}
    </div>
  );
};