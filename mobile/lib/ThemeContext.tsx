import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getBaseHue, hsbToHex, setBaseHue } from "@/constants/Colors";
import { useReaderSettings } from "@/lib/readerSettingsStore";

const STORAGE_KEY = "themeHue";

export interface ThemeColors {
  bg: string;
  page: string;
  shadow: string;
  accent: string;
  txt: string;
  sub: string;
  title: string;
  metaText: string;
  tagBg: string;
  tagText: string;
  newBadgeBg: string;
  incBg: string;
  incTxt: string;
  excBg: string;
  excTxt: string;
  searchBg: string;
  searchTxt: string;
  menuBg: string;
  menuTxt: string;
  related: string;
  surfaceElevated: string;
  iconOnSurface: string;
}

interface ThemeContextValue {
  hue: number;
  setHue: (deg: number) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [hue, _setHue] = useState(getBaseHue());
  const { settings } = useReaderSettings();

  useEffect(() => {
    const load = () =>
      AsyncStorage.getItem(STORAGE_KEY).then((v) => {
        if (v !== null) {
          const deg = Number(v);
          if (!Number.isNaN(deg)) {
            setBaseHue(deg);
            _setHue(deg);
          }
        }
      });
    load();
  }, []);

  const setHue = (deg: number) => {
    setBaseHue(deg);
    _setHue(deg);
    AsyncStorage.setItem(STORAGE_KEY, String(deg)).catch(console.warn);
  };

  const colors = useMemo<ThemeColors>(
    () => {
      const themedHex = (saturation: number, brightness: number) =>
        hsbToHex({ hue, saturation, brightness });
      const oled = settings.oledMode;
      return {
        bg: oled ? "#000000" : themedHex(6, 36),
        page: oled ? "#000000" : themedHex(6, 28),
        shadow: "#000",
        accent: themedHex(78, 210),
        txt: themedHex(6, 235),
        sub: themedHex(0, 150),
        title: themedHex(16, 225),
        metaText: themedHex(8, 200),
        tagBg: themedHex(10, 48),
        tagText: themedHex(8, 225),
        newBadgeBg: "#ff4757",
        incBg: themedHex(52, 54),
        incTxt: themedHex(20, 225),
        excBg: themedHex(0, 42),
        excTxt: themedHex(0, 210),
        searchBg: oled ? "#000000" : themedHex(6, 34),
        searchTxt: themedHex(6, 235),
        menuBg: oled ? "#000000" : themedHex(6, 32),
        menuTxt: themedHex(6, 235),
        related: themedHex(6, 28),
        surfaceElevated: themedHex(6, 34),
        iconOnSurface: themedHex(8, 210),
      };
    },
    [hue, settings.oledMode]
  );

  return (
    <ThemeContext.Provider value={{ hue, setHue, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
