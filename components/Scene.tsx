import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img } from 'remotion';
import { Scene as SceneType } from '../types';

interface SceneProps {
  scene: SceneType;
  gradient: string;
}

export const Scene: React.FC<SceneProps> = ({ scene, gradient }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  // --- TRANSITION ANIMATION (Slide Up + Fade In) ---
  // Calculates an entrance animation that feels like a slide transition
  const slideProgress = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: 20, // Fast transition
  });

  const slideY = interpolate(slideProgress, [0, 1], [height / 2, 0]); // Slide from bottom
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Ken Burns Effect (Slow Zoom for Image)
  const scaleImage = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: 'clamp',
  });

  // --- KARAOKE CAPTION LOGIC ---
  const words = useMemo(() => scene.text.split(' '), [scene.text]);
  
  // We estimate when each word should appear. 
  // We leave a small buffer at the start (15 frames) and end.
  const startBuffer = 15; 
  const endBuffer = 15;
  const availableFrames = Math.max(0, durationInFrames - startBuffer - endBuffer);
  const framesPerWord = availableFrames / words.length;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      
      {/* Background Layer with Transition */}
      <AbsoluteFill style={{ opacity, transform: `translateY(${slideY}px)` }}>
        {scene.imageUrl ? (
          <AbsoluteFill style={{ transform: `scale(${scaleImage})` }}>
            <Img 
              src={scene.imageUrl} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover' 
              }} 
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: gradient }} />
        )}

        {/* Dark Overlay */}
        <AbsoluteFill 
          style={{ 
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)' 
          }} 
        />
      </AbsoluteFill>

      {/* Dynamic Text Layer */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '12px', // Space between words
            maxWidth: '90%',
            marginTop: '200px' // Push text slightly down
          }}
        >
          {words.map((word, i) => {
            // Calculate start time for this specific word
            const wordStartFrame = startBuffer + (i * framesPerWord);
            
            // Animate word appearance (Pop in)
            const wordSpring = spring({
              frame: frame - wordStartFrame,
              fps,
              config: { stiffness: 200, damping: 15 },
            });

            const wordOpacity = interpolate(frame, [wordStartFrame, wordStartFrame + 5], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const wordScale = interpolate(wordSpring, [0, 1], [0.5, 1]);
            const wordTranslateY = interpolate(wordSpring, [0, 1], [20, 0]);

            // Highlight current word logic (optional visual flair)
            const isCurrentWord = frame >= wordStartFrame && frame < wordStartFrame + framesPerWord * 1.5;

            return (
              <span
                key={i}
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 900,
                  fontSize: '60px',
                  color: isCurrentWord ? '#fbbf24' : 'white', // Highlight gold, else white
                  lineHeight: 1.1,
                  textShadow: '3px 3px 0px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', // Hard outline effect
                  opacity: wordOpacity,
                  transform: `scale(${wordScale}) translateY(${wordTranslateY}px)`,
                  display: 'inline-block',
                  transition: 'color 0.2s ease', // Smooth color transition
                }}
              >
                {word.toUpperCase()}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Helper for TS
const height = 1920;
