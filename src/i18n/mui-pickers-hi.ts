import type { ComponentProps } from "react";
import type { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

type PickersLocaleText = NonNullable<ComponentProps<typeof LocalizationProvider>["localeText"]>;

/**
 * Hindi text for MUI X date/time pickers, which ship no Hindi of their own.
 * Modelled on their bnBD file. Field placeholders stay DD/MM/YYYY because
 * digits stay Latin across the app.
 */
const views: Record<string, string> = {
    hours: "घंटे",
    minutes: "मिनट",
    seconds: "सेकंड",
    meridiem: "AM/PM",
};

export const hiINPickers: PickersLocaleText = {
    previousMonth: "पिछला महीना",
    nextMonth: "अगला महीना",
    openPreviousView: "पिछला दृश्य खोलें",
    openNextView: "अगला दृश्य खोलें",
    calendarViewSwitchingButtonAriaLabel: (view) =>
        view === "year"
            ? "वर्ष दृश्य खुला है, कैलेंडर दृश्य पर जाएँ"
            : "कैलेंडर दृश्य खुला है, वर्ष दृश्य पर जाएँ",
    start: "शुरुआत",
    end: "अंत",
    startDate: "शुरू होने की तारीख़",
    startTime: "शुरू होने का समय",
    endDate: "समाप्ति की तारीख़",
    endTime: "समाप्ति का समय",
    cancelButtonLabel: "रद्द करें",
    clearButtonLabel: "साफ़ करें",
    okButtonLabel: "ठीक है",
    todayButtonLabel: "आज",
    nextStepButtonLabel: "अगला",
    datePickerToolbarTitle: "तारीख़ चुनें",
    dateTimePickerToolbarTitle: "तारीख़ और समय चुनें",
    timePickerToolbarTitle: "समय चुनें",
    dateRangePickerToolbarTitle: "तारीख़ की सीमा चुनें",
    clockLabelText: (view, formattedTime) =>
        `${views[view]} चुनें। ${formattedTime ? `चुना गया समय ${formattedTime}` : "कोई समय नहीं चुना गया"}`,
    hoursClockNumberText: (hours) => `${hours} घंटे`,
    minutesClockNumberText: (minutes) => `${minutes} मिनट`,
    secondsClockNumberText: (seconds) => `${seconds} सेकंड`,
    selectViewText: (view) => `${views[view]} चुनें`,
    calendarWeekNumberHeaderLabel: "सप्ताह संख्या",
    calendarWeekNumberHeaderText: "#",
    calendarWeekNumberAriaLabelText: (weekNumber) => `सप्ताह ${weekNumber}`,
    calendarWeekNumberText: (weekNumber) => `${weekNumber}`,
    openDatePickerDialogue: (formattedDate) =>
        formattedDate ? `तारीख़ चुनें, चुनी गई तारीख़ ${formattedDate}` : "तारीख़ चुनें",
    openTimePickerDialogue: (formattedTime) =>
        formattedTime ? `समय चुनें, चुना गया समय ${formattedTime}` : "समय चुनें",
    fieldClearLabel: "साफ़ करें",
    timeTableLabel: "समय चुनें",
    dateTableLabel: "तारीख़ चुनें",
    fieldYearPlaceholder: (params) => "Y".repeat(params.digitAmount),
    fieldMonthPlaceholder: (params) => (params.contentType === "letter" ? "MMMM" : "MM"),
    fieldDayPlaceholder: () => "DD",
    fieldWeekDayPlaceholder: (params) => (params.contentType === "letter" ? "EEEE" : "EE"),
    fieldHoursPlaceholder: () => "hh",
    fieldMinutesPlaceholder: () => "mm",
    fieldSecondsPlaceholder: () => "ss",
    fieldMeridiemPlaceholder: () => "aa",
    year: "वर्ष",
    month: "महीना",
    day: "दिन",
    weekDay: "सप्ताह का दिन",
    hours: "घंटे",
    minutes: "मिनट",
    seconds: "सेकंड",
    meridiem: "AM/PM",
    empty: "खाली",
};
