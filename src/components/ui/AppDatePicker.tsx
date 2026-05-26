"use client";

/**
 * AppDatePicker & AppMonthPicker
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacements for <input type="date"> and <input type="month">.
 * These use MUI x-date-pickers which render a proper calendar dialog/popover
 * on ALL devices (instead of the uncontrollable blue OS-native picker on mobile).
 *
 * Theme is derived automatically from next-themes' resolvedTheme, mapping to
 * the three app themes: light (Aurora Violet), dark (Midnight Navy), teal.
 *
 * Change once here → all pickers in the app update.
 */

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

// ── Colour palettes — one per app theme ──────────────────────────────────────

const PALETTES = {
  light: {
    mode: "light" as const,
    brand: "#7c3aed",
    brandAlpha: "rgba(124,58,237,0.08)",
    surface: "#ffffff",
    surfaceSec: "#f5f3ff",
    ink: "#1e1b4b",
    inkMuted: "#6b7280",
    border: "#e2e8f0",
  },
  dark: {
    mode: "dark" as const,
    brand: "#60a5fa",
    brandAlpha: "rgba(96,165,250,0.12)",
    surface: "#082032",
    surfaceSec: "#0d2942",
    ink: "#eef5ff",
    inkMuted: "#7ca8c9",
    border: "rgba(255,255,255,0.12)",
  },
  teal: {
    mode: "light" as const,
    brand: "#0d9488",
    brandAlpha: "rgba(13,148,136,0.08)",
    surface: "#ffffff",
    surfaceSec: "#ccfbf1",
    ink: "#042f2e",
    inkMuted: "#4b7c78",
    border: "rgba(13,148,136,0.25)",
  },
} as const;

type ThemeKey = keyof typeof PALETTES;
type Palette = (typeof PALETTES)[ThemeKey];

function toThemeKey(rt: string | undefined): ThemeKey {
  if (rt === "dark" || rt === "teal") return rt;
  return "light";
}

// ── MUI theme factory ────────────────────────────────────────────────────────

function buildMuiTheme(p: Palette) {
  return createTheme({
    palette: {
      mode: p.mode,
      primary: { main: p.brand },
      background: { paper: p.surface, default: p.surface },
      text: { primary: p.ink, secondary: p.inkMuted },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none", backgroundColor: p.surface },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: p.surface,
            backgroundImage: "none",
            borderRadius: "1.25rem",
          },
        },
      },
      MuiPickersDay: {
        styleOverrides: {
          root: {
            color: p.ink,
            borderRadius: "50%",
            /* eslint-disable @typescript-eslint/naming-convention */
            "&.Mui-selected": { backgroundColor: p.brand, color: "#fff" },
            "&.Mui-selected:hover": { backgroundColor: p.brand },
            "&.MuiPickersDay-today:not(.Mui-selected)": {
              borderColor: p.brand,
              borderWidth: 2,
            },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiDateCalendar: {
        styleOverrides: {
          root: { backgroundColor: p.surface, color: p.ink, maxHeight: 380 },
        },
      },
      MuiPickersCalendarHeader: {
        styleOverrides: {
          label: { color: p.ink, fontWeight: 700 },
          switchViewButton: { color: p.ink },
          switchViewIcon: { color: p.inkMuted },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { color: p.ink } },
      },
      MuiDayCalendar: {
        styleOverrides: {
          weekDayLabel: { color: p.inkMuted, fontWeight: 600, fontSize: "0.75rem" },
        },
      },
      MuiYearCalendar: {
        styleOverrides: { root: { color: p.ink } },
      },
      MuiPickersYear: {
        styleOverrides: {
          yearButton: {
            color: p.ink,
            "&.Mui-selected": { backgroundColor: p.brand, color: "#fff" },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiPickersMonth: {
        styleOverrides: {
          monthButton: {
            color: p.ink,
            "&.Mui-selected": { backgroundColor: p.brand, color: "#fff" },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface,
            "& .MuiButton-root": { color: p.brand, fontWeight: 600 },
          },
        },
      },
    },
  });
}

// ── Shared text-field sx ─────────────────────────────────────────────────────

function buildTextFieldSx(p: Palette) {
  return {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      backgroundColor: p.surface,
      borderRadius: "0.5rem",
      color: p.ink,
      fontSize: "0.875rem",
      "& fieldset": { borderColor: p.border },
      "&:hover fieldset": { borderColor: p.brand },
      "&.Mui-focused fieldset": { borderColor: p.brand, borderWidth: "2px" },
      "&.Mui-disabled": { opacity: 0.55 },
    },
    "& .MuiInputBase-input": {
      padding: "8px 14px",
      color: p.ink,
      fontSize: "0.875rem",
      "&.Mui-disabled": { WebkitTextFillColor: p.inkMuted },
    },
    "& .MuiSvgIcon-root": { color: p.brand },
    "& .MuiInputAdornment-root button": {
      color: p.brand,
      "&:hover": { backgroundColor: p.brandAlpha },
    },
  };
}

function popperSx(border: string) {
  return {
    "& .MuiPaper-root": {
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      borderRadius: "0.75rem",
      overflow: "hidden",
      border: `1px solid ${border}`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AppDatePicker
// ─────────────────────────────────────────────────────────────────────────────

export interface AppDatePickerProps {
  /** Controlled date string in YYYY-MM-DD format, or '' when unset */
  value: string;
  /** Called with the selected YYYY-MM-DD string, or '' when cleared */
  onChange: (value: string) => void;
  /** Minimum selectable date as YYYY-MM-DD */
  min?: string;
  /** Maximum selectable date as YYYY-MM-DD */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  /** Optional Tailwind class applied to the outer wrapper div (for layout) */
  className?: string;
}

export function AppDatePicker({
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  name,
  placeholder,
  className,
}: AppDatePickerProps) {
  const { resolvedTheme } = useTheme();
  const key = toThemeKey(resolvedTheme);
  const palette = PALETTES[key];
  // Only rebuilds when the theme key changes
  const muiTheme = useMemo(() => buildMuiTheme(palette), [palette]);

  const dayjsValue = value ? dayjs(value, "YYYY-MM-DD") : null;
  const minDate = min ? dayjs(min, "YYYY-MM-DD") : undefined;
  const maxDate = max ? dayjs(max, "YYYY-MM-DD") : undefined;

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal?.isValid() ? newVal.format("YYYY-MM-DD") : "");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <div className={className} style={{ width: "100%" }}>
          <DatePicker
            value={dayjsValue}
            onChange={handleChange}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            format="DD/MM/YYYY"
            slotProps={{
              textField: {
                required,
                name,
                placeholder: placeholder ?? "DD/MM/YYYY",
                size: "small",
                fullWidth: true,
                sx: buildTextFieldSx(palette),
              },
              popper: { sx: popperSx(palette.border) },
              dialog: {
                sx: {
                  "& .MuiDialog-paper": { borderRadius: "1.25rem", overflow: "hidden" },
                },
              },
            }}
          />
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppMonthPicker
// ─────────────────────────────────────────────────────────────────────────────

export interface AppMonthPickerProps {
  /** Controlled value in YYYY-MM format, or '' when unset */
  value: string;
  /** Called with the selected YYYY-MM string, or '' when cleared */
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
}

export function AppMonthPicker({
  value,
  onChange,
  required,
  disabled,
  name,
  placeholder,
  className,
}: AppMonthPickerProps) {
  const { resolvedTheme } = useTheme();
  const key = toThemeKey(resolvedTheme);
  const palette = PALETTES[key];
  const muiTheme = useMemo(() => buildMuiTheme(palette), [palette]);

  // Use day-01 internally so dayjs can parse it
  const dayjsValue = value ? dayjs(`${value}-01`, "YYYY-MM-DD") : null;

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal?.isValid() ? newVal.format("YYYY-MM") : "");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <div className={className} style={{ width: "100%" }}>
          <DatePicker
            value={dayjsValue}
            onChange={handleChange}
            views={["year", "month"]}
            openTo="month"
            disabled={disabled}
            format="MMMM YYYY"
            slotProps={{
              textField: {
                required,
                name,
                placeholder: placeholder ?? "Select month",
                size: "small",
                fullWidth: true,
                sx: buildTextFieldSx(palette),
              },
              popper: { sx: popperSx(palette.border) },
              dialog: {
                sx: {
                  "& .MuiDialog-paper": { borderRadius: "1.25rem", overflow: "hidden" },
                },
              },
            }}
          />
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
