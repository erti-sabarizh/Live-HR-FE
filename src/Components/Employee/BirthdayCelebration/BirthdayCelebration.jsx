import React, { useState, useEffect, useCallback } from "react";
import PartyPopper from "./PartyPopper";
import ConfettiEffect from "./ConfettiEffect";
import BirthdayCard from "./BirthdayCard";
import "./BirthdayCelebration.css";

/**
 * BirthdayCelebration Component
 * Cinematic birthday celebration animation overlay:
 * 1. Dashboard background with light, reduced blur (dashboard remains clearly visible).
 * 2. Real 3D party poppers (/popper.glb + WebGL Three.js) fixed at bottom corners,
 *    blasting once with 3D recoil and massive paper showers.
 * 3. Birthday card rising from bottom center with transparent background preserved.
 * 4. Letter-by-letter typing animation for all greeting text inside the card.
 * 5. Smooth fade-in "Thank You" button positioned at the bottom of the screen (away from the card),
 *    appearing ONLY AFTER all card text has completely finished typing.
 * 6. Remains open until employee clicks "Thank You".
 */
const BirthdayCelebration = ({
  employeeName = "Team Member",
  onComplete = () => {},
}) => {
  const [blasting, setBlasting] = useState(false);
  const [blastTrigger, setBlastTrigger] = useState(0);
  const [cardEntered, setCardEntered] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  const [showThankYouBtn, setShowThankYouBtn] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isOverlayFading, setIsOverlayFading] = useState(false);

  // Initial Entrance Sequence
  useEffect(() => {
    const timers = [];

    // Stage 1: Real 3D Poppers blast once with 3D recoil at 0.3s
    timers.push(
      setTimeout(() => {
        setBlasting(true);
        setBlastTrigger(1);
      }, 300)
    );

    // Poppers recoil settles
    timers.push(
      setTimeout(() => {
        setBlasting(false);
      }, 1100)
    );

    // Stage 2: Birthday Card rises from bottom into center at 0.5s
    timers.push(
      setTimeout(() => {
        setCardEntered(true);
      }, 500)
    );

    // Stage 3: Start rapid letter-by-letter typewriter animation once card is centered at 0.75s
    timers.push(
      setTimeout(() => {
        setStartTyping(true);
      }, 750)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Called when all letters in the card have finished typing completely
  const handleTypingComplete = useCallback(() => {
    setShowThankYouBtn(true);
  }, []);

  // User-Controlled Close Handler (triggered by clicking "Thank You" button)
  const handleClose = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true); // Smoothly animate out card & 3D poppers

    setTimeout(() => {
      setIsOverlayFading(true); // Dissolve blur
    }, 550);

    setTimeout(() => {
      if (onComplete) onComplete(); // Unmount & restore normal dashboard
    }, 1100);
  }, [isExiting, onComplete]);

  return (
    <div
      className={`bday-celebration-overlay ${
        isOverlayFading ? "bday-overlay-fading" : ""
      }`}
      aria-label="Birthday Celebration"
    >
      {/* Fullscreen Confetti Canvas (Fixed to viewport) */}
      <ConfettiEffect active={!isExiting} blastTrigger={blastTrigger} />

      {/* Real 3D Left Party Popper (Fixed to bottom-left corner of screen) */}
      <PartyPopper
        side="left"
        blasting={blasting}
        exiting={isExiting}
      />

      {/* Real 3D Right Party Popper (Fixed to bottom-right corner of screen) */}
      <PartyPopper
        side="right"
        blasting={blasting}
        exiting={isExiting}
      />

      {/* Birthday Card Centered in Viewport */}
      <BirthdayCard
        employeeName={employeeName}
        cardEntered={cardEntered}
        cardExiting={isExiting}
        startTyping={startTyping}
        onTypingComplete={handleTypingComplete}
      />

      {/* Thank You Button positioned at the bottom of the screen (away from the card),
          Fades in only after letter-by-letter typing is fully completed */}
      {showThankYouBtn && (
        <div className={`bday-bottom-action-wrap ${isExiting ? "bday-btn-exiting" : ""}`}>
          <button
            type="button"
            className="bday-thank-you-btn"
            onClick={handleClose}
          >
            Thank You
          </button>
        </div>
      )}
    </div>
  );
};

export default BirthdayCelebration;
