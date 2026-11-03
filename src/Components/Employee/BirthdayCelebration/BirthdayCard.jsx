import React from "react";
import BirthdayText from "./BirthdayText";
import "./BirthdayCelebration.css";

/**
 * BirthdayCard Component
 * Displays `/Birthday-card.png` in the center of the viewport
 * with typewriter greeting text typed letter-by-letter in the empty ivory panel.
 */
const BirthdayCard = ({
  employeeName = "Team Member",
  cardEntered = false,
  cardExiting = false,
  startTyping = false,
  onTypingComplete = () => {},
}) => {
  return (
    <div
      className={`bday-card-centering-wrap ${
        cardEntered ? "bday-card-entered" : "bday-card-pre-entrance"
      } ${cardExiting ? "bday-card-exiting" : ""}`}
    >
      <div className="bday-card-aspect-box">
        {/* Existing Birthday Card Asset with transparent background preserved */}
        <img
          src="/Birthday-card.png"
          alt="Birthday Card"
          className="bday-card-bg-img"
          draggable={false}
        />

        {/* Dynamic Birthday Text Overlay (Typewriter method letter by letter) */}
        <div className="bday-card-content-overlay">
          <BirthdayText
            employeeName={employeeName}
            startTyping={startTyping}
            onTypingComplete={onTypingComplete}
          />
        </div>
      </div>
    </div>
  );
};

export default BirthdayCard;
