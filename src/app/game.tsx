import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  useAnimatedGestureHandler,
  withSequence,
} from 'react-native-reanimated';
import { GestureHandlerRootView, TapGestureHandler } from 'react-native-gesture-handler';
import * as AC from '@bacons/apple-colors';

const GRAVITY = 0.6;
const JUMP_HEIGHT = -12;
const PIPE_WIDTH = 80;
const PIPE_GAP = 200;
const PIPE_SPEED = 2;

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

export default function FlappyBirdGame() {
  const { width, height } = useWindowDimensions();
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);

  // Bird physics
  const birdY = useSharedValue(height / 2);
  const birdVelocity = useSharedValue(0);
  const birdRotation = useSharedValue(0);

  // Game loop
  const gameLoopRef = useRef<NodeJS.Timeout>();
  const pipeGenerationRef = useRef<NodeJS.Timeout>();

  const resetGame = () => {
    birdY.value = height / 2;
    birdVelocity.value = 0;
    birdRotation.value = 0;
    setScore(0);
    setPipes([]);
    setIsGameOver(false);
    setIsGameStarted(false);
  };

  const startGame = () => {
    if (isGameOver) {
      resetGame();
      return;
    }

    setIsGameStarted(true);

    // Start game loop
    gameLoopRef.current = setInterval(() => {
      // Update bird physics
      birdVelocity.value += GRAVITY;
      birdY.value += birdVelocity.value;

      // Update bird rotation based on velocity
      birdRotation.value = withTiming(
        interpolate(birdVelocity.value, [-10, 10], [-20, 90], 'clamp')
      );

      // Check if bird hits ground or ceiling
      if (birdY.value > height - 100 || birdY.value < 50) {
        runOnJS(endGame)();
      }

      // Update pipes
      setPipes((currentPipes) => {
        const newPipes = currentPipes.map(pipe => ({
          ...pipe,
          x: pipe.x - PIPE_SPEED
        }));

        // Check collisions
        const birdX = 100;
        const birdRadius = 20;
        const currentBirdY = birdY.value;

        for (const pipe of newPipes) {
          if (
            birdX + birdRadius > pipe.x &&
            birdX - birdRadius < pipe.x + PIPE_WIDTH &&
            (currentBirdY - birdRadius < pipe.topHeight ||
             currentBirdY + birdRadius > height - pipe.bottomHeight)
          ) {
            runOnJS(endGame)();
            break;
          }

          // Check if bird passed pipe for scoring
          if (!pipe.passed && pipe.x + PIPE_WIDTH < birdX) {
            pipe.passed = true;
            runOnJS(incrementScore)();
          }
        }

        // Remove pipes that are off screen
        return newPipes.filter(pipe => pipe.x > -PIPE_WIDTH);
      });
    }, 16); // ~60fps

    // Generate pipes
    pipeGenerationRef.current = setInterval(() => {
      const topHeight = Math.random() * (height - PIPE_GAP - 200) + 100;
      const bottomHeight = height - topHeight - PIPE_GAP;

      setPipes((currentPipes) => [
        ...currentPipes,
        {
          x: width,
          topHeight,
          bottomHeight,
          passed: false,
        }
      ]);
    }, 2000);
  };

  const endGame = () => {
    setIsGameOver(true);
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    if (pipeGenerationRef.current) {
      clearInterval(pipeGenerationRef.current);
    }
  };

  const incrementScore = () => {
    setScore(prev => prev + 1);
  };

  const handleTap = () => {
    if (!isGameStarted && !isGameOver) {
      startGame();
      return;
    }

    if (isGameOver) {
      resetGame();
      return;
    }

    // Jump
    birdVelocity.value = JUMP_HEIGHT;
    birdRotation.value = withSequence(
      withTiming(-20, { duration: 100 }),
      withTiming(0, { duration: 200 })
    );
  };

  const birdAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: birdY.value },
        { rotate: `${birdRotation.value}deg` },
      ],
    };
  });

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      if (pipeGenerationRef.current) {
        clearInterval(pipeGenerationRef.current);
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      <TapGestureHandler onActivated={handleTap}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: '#87CEEB', // Sky blue
            position: 'relative',
          }}
        >
          {/* Background gradient effect */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: height * 0.7,
              backgroundColor: 'transparent',
              background: 'linear-gradient(to bottom, #87CEEB, #98D8E8)',
            }}
          />

          {/* Ground */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 100,
              backgroundColor: '#8B4513',
            }}
          />

          {/* Pipes */}
          {pipes.map((pipe, index) => (
            <React.Fragment key={index}>
              {/* Top pipe */}
              <View
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: pipe.topHeight,
                  backgroundColor: '#228B22',
                  borderRadius: 5,
                }}
              />
              {/* Bottom pipe */}
              <View
                style={{
                  position: 'absolute',
                  left: pipe.x,
                  bottom: 100, // Above ground
                  width: PIPE_WIDTH,
                  height: pipe.bottomHeight,
                  backgroundColor: '#228B22',
                  borderRadius: 5,
                }}
              />
            </React.Fragment>
          ))}

          {/* Bird */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 100,
                width: 40,
                height: 40,
                backgroundColor: '#FFD700', // Gold
                borderRadius: 20,
                borderWidth: 2,
                borderColor: '#FFA500', // Orange border
              },
              birdAnimatedStyle,
            ]}
          />

          {/* Score */}
          <Text
            style={{
              position: 'absolute',
              top: 80,
              alignSelf: 'center',
              fontSize: 48,
              fontWeight: 'bold',
              color: 'white',
              textShadowColor: 'black',
              textShadowOffset: { width: 2, height: 2 },
              textShadowRadius: 4,
              fontVariant: ['tabular-nums'],
            }}
          >
            {score}
          </Text>

          {/* Start/Game Over Screen */}
          {(!isGameStarted || isGameOver) && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center',
                }}
              >
                {isGameOver ? 'Game Over!' : 'Flappy Bird'}
              </Text>

              {isGameOver && (
                <Text
                  style={{
                    fontSize: 24,
                    color: 'white',
                    textAlign: 'center',
                  }}
                >
                  Final Score: {score}
                </Text>
              )}

              <Pressable
                onPress={handleTap}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#2980b9' : '#3498db',
                  paddingHorizontal: 30,
                  paddingVertical: 15,
                  borderRadius: 25,
                  borderWidth: 2,
                  borderColor: 'white',
                })}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 20,
                    fontWeight: 'bold',
                  }}
                >
                  {isGameOver ? 'Play Again' : 'Start Game'}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
}