import React, { useState, useEffect, useRef } from "react";
import "./BirthdayCelebration.css";

/**
 * BirthdayText Component (Rapid Typewriter Method - Letter by Letter)
 * Fast, crisp typewriter animation typing out greeting text letter-by-letter:
 * 1. "Happy"
 * 2. "Birthday!"
 * 3. "[Employee Name]!"
 * 4. Heart divider ❤️
 * 5. Message lines:
 *    - "Wishing you a day filled"
 *    - "with happiness, success"
 *    - "and wonderful moments!"
 * 6. Footer:
 *    - "With love,"
 *    - "Team Ertitech ❤️"
 *
 * Types quickly (~0.65s total) so the animation feels snappy and energetic,
 * immediately followed by onTypingComplete() to reveal the "Thank You" button.
 */
const BirthdayText = ({
  employeeName = "Team Member",
  startTyping = false,
  onTypingComplete = () => {},
}) => {
  const [typedHappy, setTypedHappy] = useState("");
  const [typedBirthday, setTypedBirthday] = useState("");
  const [typedName, setTypedName] = useState("");
  const [showHeart, setShowHeart] = useState(false);
  const [typedMsg1, setTypedMsg1] = useState("");
  const [typedMsg2, setTypedMsg2] = useState("");
  const [typedMsg3, setTypedMsg3] = useState("");
  const [typedFooter1, setTypedFooter1] = useState("");
  const [typedFooter2, setTypedFooter2] = useState("");
  const [activeLine, setActiveLine] = useState("");

  const completeCalledRef = useRef(false);

  useEffect(() => {
    if (!startTyping) return;

    let cancelled = false;
    const cleanName = (employeeName || "Team Member").trim();

    // Fast, energetic typing steps (~0.65s total across entire greeting)
    const steps = [
      { key: "happy", text: "Happy", setter: setTypedHappy, stepSize: 1, interval: 10, pause: 15 },
      { key: "birthday", text: "Birthday!", setter: setTypedBirthday, stepSize: 2, interval: 10, pause: 20 },
      { key: "name", text: `${cleanName}!`, setter: setTypedName, stepSize: 1, interval: 10, pause: 20 },
      { key: "heart", text: "", setter: () => setShowHeart(true), stepSize: 0, interval: 0, pause: 20 },
      { key: "msg1", text: "Wishing you a day filled", setter: setTypedMsg1, stepSize: 2, interval: 10, pause: 15 },
      { key: "msg2", text: "with happiness, success", setter: setTypedMsg2, stepSize: 2, interval: 10, pause: 15 },
      { key: "msg3", text: "and wonderful moments!", setter: setTypedMsg3, stepSize: 2, interval: 10, pause: 20 },
      { key: "footer1", text: "With love,", setter: setTypedFooter1, stepSize: 2, interval: 10, pause: 15 },
      { key: "footer2", text: "Team Ertitech ❤️", setter: setTypedFooter2, stepSize: 2, interval: 10, pause: 40 },
    ];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const runTypewriter = async () => {
      for (const step of steps) {
        if (cancelled) return;
        setActiveLine(step.key);

        if (step.stepSize === 0) {
          step.setter();
          await sleep(step.pause);
        } else {
          const targetStr = step.text;
          let currentLen = 0;

          while (currentLen < targetStr.length) {
            if (cancelled) return;
            currentLen = Math.min(currentLen + step.stepSize, targetStr.length);
            step.setter(targetStr.slice(0, currentLen));
            await sleep(step.interval);
          }
          await sleep(step.pause);
        }
      }

      if (!cancelled) {
        setActiveLine("");
        if (!completeCalledRef.current) {
          completeCalledRef.current = true;
          onTypingComplete();
        }
      }
    };

    runTypewriter();

    return () => {
      cancelled = true;
    };
  }, [startTyping, employeeName, onTypingComplete]);

  return (
    <div className="bday-card-text-container">
      {/* 1. Main Heading: HAPPY BIRTHDAY! (Rapid Letter-by-Letter) */}
      <div className="bday-text-heading">
        <span className="bday-heading-happy">
          {typedHappy}
          {activeLine === "happy" && <span className="bday-caret">|</span>}
        </span>
        <span className="bday-heading-birthday">
          {typedBirthday}
          {activeLine === "birthday" && <span className="bday-caret">|</span>}
        </span>
      </div>

      {/* 2. Employee Name (Rapid Letter-by-Letter) */}
      <div className="bday-text-name-wrapper">
        <h2 className="bday-text-employee-name">
          {typedName}
          {activeLine === "name" && <span className="bday-caret">|</span>}
        </h2>

        {/* Decorative Heart Divider */}
        <div className={`bday-heart-divider ${showHeart ? "bday-heart-visible" : "bday-heart-hidden"}`}>
          <span className="bday-heart-icon">❤️</span>
        </div>
      </div>

      {/* 3. Birthday Message (Rapid Letter-by-Letter) */}
      <div className="bday-text-message">
        <p className="bday-message-line line-1">
          {typedMsg1}
          {activeLine === "msg1" && <span className="bday-caret">|</span>}
        </p>
        <p className="bday-message-line line-2">
          {typedMsg2}
          {activeLine === "msg2" && <span className="bday-caret">|</span>}
        </p>
        <p className="bday-message-line line-3">
          {typedMsg3}
          {activeLine === "msg3" && <span className="bday-caret">|</span>}
        </p>
      </div>

      {/* 4. Team Ertitech Footer (Rapid Letter-by-Letter) */}
      <div className="bday-text-footer">
        <p className="bday-footer-love">
          {typedFooter1}
          {activeLine === "footer1" && <span className="bday-caret">|</span>}
        </p>
        <p className="bday-footer-team">
          {typedFooter2}
          {activeLine === "footer2" && <span className="bday-caret">|</span>}
        </p>
      </div>
    </div>
  );
};

export default BirthdayText;