import React, { useMemo } from 'react';
import { Series, AbsoluteFill, Audio } from 'remotion';
import { VideoScript } from '../types';
import { Scene } from './Scene';
import { VIDEO_FPS, GRADIENTS, MUSIC_TRACKS } from '../constants';

interface VideoCompositionProps {
  script: VideoScript;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ script }) => {
  
  // Select music based on mood, fallback to Default
  const musicUrl = useMemo(() => {
    // Basic fuzzy matching for mood
    const mood = script.backgroundMusicMood;
    const availableMoods = Object.keys(MUSIC_TRACKS);
    
    // Find a key that is contained in the mood string (e.g. "Sadness" matches "Sad")
    const matchedKey = availableMoods.find(key => 
      mood.toLowerCase().includes(key.toLowerCase())
    );

    return matchedKey ? MUSIC_TRACKS[matchedKey] : MUSIC_TRACKS['Default'];
  }, [script.backgroundMusicMood]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background Music - Variable based on mood */}
      <Audio 
        src={musicUrl} 
        volume={0.2} 
        loop 
      />

      <Series>
        {script.scenes.map((scene, index) => {
          const durationInFrames = Math.ceil(scene.durationInSeconds * VIDEO_FPS);
          const gradient = GRADIENTS[index % GRADIENTS.length];

          return (
            <Series.Sequence key={index} durationInFrames={durationInFrames}>
              <Scene scene={scene} gradient={gradient} />
              
              {/* Voiceover Track */}
              {scene.audioUrl && (
                <Audio 
                  src={scene.audioUrl} 
                  volume={1} 
                />
              )}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
