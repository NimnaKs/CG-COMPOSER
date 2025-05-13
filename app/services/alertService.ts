const cricketAlerts: string[] = [
  "WICKET! Virat Kohli caught behind for 45 runs!",
  "SIX! Rohit Sharma hits a massive six over long-on!",
  "FOUR! Beautiful cover drive by Kane Williamson!",
  "WICKET! Steve Smith bowled by a stunning yorker!",
  "WIDE DELIVERY! The ball goes way outside off stump",
  "FREE HIT! No-ball called, next delivery is a free hit",
  "SIX! MS Dhoni finishes in style with a huge six!",
  "WICKET! Joe Root trapped LBW for 67!",
  "FOUR! Babar Azam plays an elegant late cut!",
  "WICKET! David Warner caught in the slips!"
];

let currentAlertIndex = 0;

type AlertCallback = (alert: string) => void;

export const startAlertService = (callback: AlertCallback): ReturnType<typeof setInterval> => {
  // Reset index when starting
  currentAlertIndex = 0;

  // Set up interval to send alerts every 30 seconds
  const intervalId = setInterval(() => {
    if (currentAlertIndex < cricketAlerts.length) {
      callback(cricketAlerts[currentAlertIndex]);
      currentAlertIndex++;
    } else {
      // Stop the interval when all alerts have been shown
      clearInterval(intervalId);
    }
  }, 30000);

  // Return the interval ID so it can be cleared if needed
  return intervalId;
};

export const stopAlertService = (intervalId: ReturnType<typeof setInterval>): void => {
  clearInterval(intervalId);
}; 