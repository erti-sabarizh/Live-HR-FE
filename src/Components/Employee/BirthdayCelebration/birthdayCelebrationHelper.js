/**
 * Birthday Celebration Utilities
 * Ertitech HR Portal
 */

/**
 * Compare if a given Date of Birth matches today in Asia/Kolkata timezone.
 * @param {string|Date} dob - Employee's Date of Birth
 * @returns {boolean}
 */
export const isBirthdayTodayInKolkata = (dob) => {
  if (!dob) return false;
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) return false;

  const now = new Date();
  const getISTMonthDay = (dateObj) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(dateObj);
    let month = 0;
    let day = 0;
    for (const p of parts) {
      if (p.type === "month") month = parseInt(p.value, 10);
      if (p.type === "day") day = parseInt(p.value, 10);
    }
    return { month, day };
  };

  const today = getISTMonthDay(now);
  const birth = getISTMonthDay(dobDate);

  return today.month === birth.month && today.day === birth.day;
};

/**
 * Check whether the birthday celebration should trigger for this employee.
 * Trigger conditions:
 * 1. Today is employee's birthday (checked via Asia/Kolkata timezone or backend flag).
 * 2. Has not already played in this current login session (prevents replay on refresh).
 * 3. When employee logs out and logs in again, a new login session is created so it plays again!
 *
 * @param {Object} employee - Employee object from /users/get-details
 * @param {Array} todayBirthdays - List of today's birthdays from /users/today-birthdays
 * @param {string} loggedInUserId - Current logged in user ID
 * @returns {boolean}
 */
export const shouldTriggerCelebration = (employee, todayBirthdays = [], loggedInUserId = null) => {
  if (!employee && (!todayBirthdays || todayBirthdays.length === 0)) {
    return false;
  }

  // Check 1: Backend explicit flag
  let isBirthday = employee?.isBirthdayToday === true;

  // Check 2: Asia/Kolkata DOB match
  if (!isBirthday && employee?.dob) {
    isBirthday = isBirthdayTodayInKolkata(employee.dob);
  }

  // Check 3: Presence in todayBirthdays endpoint
  if (!isBirthday && Array.isArray(todayBirthdays) && todayBirthdays.length > 0) {
    const candidateIds = [
      loggedInUserId,
      employee?._id,
      employee?.empId?._id,
      employee?.empId,
    ]
      .filter(Boolean)
      .map((id) => String(id));

    isBirthday = todayBirthdays.some((b) =>
      candidateIds.includes(String(b._id)) || candidateIds.includes(String(b.empId))
    );
  }

  if (!isBirthday) return false;

  // Check 4: Check if already played in the current login session
  const loginTime = sessionStorage.getItem("loginTime") || "active_session";
  const userKey = loggedInUserId || employee?.empId || employee?._id || "emp";
  const sessionKey = `bday_played_${userKey}_${loginTime}`;

  if (
    sessionStorage.getItem(sessionKey) === "true" ||
    sessionStorage.getItem("birthday_animation_played_session") === "true"
  ) {
    return false;
  }

  return true;
};

/**
 * Mark celebration as played for this active login session.
 * @param {Object} employee
 * @param {string} loggedInUserId
 */
export const markCelebrationPlayedInSession = (employee, loggedInUserId = null) => {
  const loginTime = sessionStorage.getItem("loginTime") || "active_session";
  const userKey = loggedInUserId || employee?.empId || employee?._id || "emp";
  const sessionKey = `bday_played_${userKey}_${loginTime}`;

  try {
    sessionStorage.setItem(sessionKey, "true");
    sessionStorage.setItem("birthday_animation_played_session", "true");
  } catch (err) {
    console.warn("Storage write error:", err);
  }
};

/**
 * Reset celebration for testing/preview.
 */
export const resetCelebrationForTesting = () => {
  try {
    sessionStorage.removeItem("birthday_animation_played_session");
    sessionStorage.removeItem("birthdayAnimationShown");
    const loginTime = sessionStorage.getItem("loginTime") || "active_session";
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("bday_played_")) {
        sessionStorage.removeItem(k);
      }
    });
  } catch (err) {
    console.warn("Reset error:", err);
  }
};
