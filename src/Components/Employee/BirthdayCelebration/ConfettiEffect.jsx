import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import "./BirthdayCelebration.css";

/**
 * ConfettiEffect Component
 * - Single massive celebratory explosion of papers, confetti, streamers, and stars
 *   shooting diagonally from both 3D poppers towards the center.
 * - Gentle continuous fluttering paper shower from top while celebration is active.
 */
const ConfettiEffect = ({ active = true, blastTrigger = 0 }) => {
  const canvasRef = useRef(null);
  const confettiInstanceRef = useRef(null);
  const showerIntervalRef = useRef(null);

  // Vibrant celebration palette
  const CELEBRATION_COLORS = [
    "#10B981", // Emerald Green
    "#F97316", // Warm Orange
    "#EF4444", // Bright Red
    "#3B82F6", // Royal Blue
    "#8B5CF6", // Festive Purple
    "#F59E0B", // Shimmering Gold
    "#EC4899", // Party Magenta
    "#06B6D4", // Electric Cyan
    "#EAB308", // Golden Yellow
  ];

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      confettiInstanceRef.current = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true,
      });
    } catch (err) {
      console.warn("Falling back to default confetti:", err);
      confettiInstanceRef.current = confetti;
    }

    return () => {
      if (showerIntervalRef.current) clearInterval(showerIntervalRef.current);
      if (confettiInstanceRef.current && confettiInstanceRef.current.reset) {
        confettiInstanceRef.current.reset();
      }
    };
  }, []);

  // One-time massive blast from both 3D poppers
  useEffect(() => {
    if (!active || blastTrigger === 0) return;
    const fire = confettiInstanceRef.current;
    if (!fire) return;

    // LEFT 3D POPPER BLAST (Huge shower of paper pieces & confetti)
    fire({
      particleCount: 140,
      angle: 55,
      spread: 75,
      origin: { x: 0.08, y: 0.90 },
      startVelocity: 88,
      colors: CELEBRATION_COLORS,
      ticks: 400,
      gravity: 0.82,
      scalar: 1.25,
      drift: 0.25,
    });

    // RIGHT 3D POPPER BLAST (Huge shower of paper pieces & confetti)
    fire({
      particleCount: 140,
      angle: 125,
      spread: 75,
      origin: { x: 0.92, y: 0.90 },
      startVelocity: 88,
      colors: CELEBRATION_COLORS,
      ticks: 400,
      gravity: 0.82,
      scalar: 1.25,
      drift: -0.25,
    });

    // Large floating rectangular paper streamers from left
    fire({
      particleCount: 50,
      angle: 52,
      spread: 50,
      origin: { x: 0.08, y: 0.90 },
      startVelocity: 95,
      colors: CELEBRATION_COLORS,
      shapes: ["square"],
      scalar: 1.8,
      ticks: 450,
      gravity: 0.75,
    });

    // Large floating rectangular paper streamers from right
    fire({
      particleCount: 50,
      angle: 128,
      spread: 50,
      origin: { x: 0.92, y: 0.90 },
      startVelocity: 95,
      colors: CELEBRATION_COLORS,
      shapes: ["square"],
      scalar: 1.8,
      ticks: 450,
      gravity: 0.75,
    });
  }, [active, blastTrigger]);

  // Continuous gentle fluttering celebration shower from top
  useEffect(() => {
    if (!active) {
      if (showerIntervalRef.current) clearInterval(showerIntervalRef.current);
      return;
    }

    const fire = confettiInstanceRef.current;
    if (!fire) return;

    const showerTimer = setTimeout(() => {
      showerIntervalRef.current = setInterval(() => {
        if (!active) return;

        fire({
          particleCount: 5,
          angle: 90,
          spread: 120,
          origin: {
            x: 0.12 + Math.random() * 0.76,
            y: -0.04,
          },
          startVelocity: 15 + Math.random() * 14,
          gravity: 0.65,
          colors: CELEBRATION_COLORS,
          scalar: 0.9 + Math.random() * 0.5,
          ticks: 320,
          drift: (Math.random() - 0.5) * 0.5,
        });
      }, 260);
    }, 1100);

    return () => {
      clearTimeout(showerTimer);
      if (showerIntervalRef.current) clearInterval(showerIntervalRef.current);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="bday-confetti-canvas"
      aria-hidden="true"
    />
  );
};

export default ConfettiEffect;
