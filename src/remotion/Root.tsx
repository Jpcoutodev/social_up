import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from '../../components/VideoComposition';
import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '../../constants';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="VideoComposition"
                component={VideoComposition}
                durationInFrames={300} // Default, overridden by props
                fps={VIDEO_FPS}
                width={VIDEO_WIDTH}
                height={VIDEO_HEIGHT}
                defaultProps={{
                    script: {
                        title: "Default Video",
                        backgroundMusicMood: "Happy",
                        scenes: []
                    }
                }}
            />
        </>
    );
};
