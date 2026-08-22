import React, { createContext, useContext, useState, useCallback } from "react";

interface DrawerContextValue {
  isOpen: boolean;
  swipeEnabled: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setSwipeEnabled: (enabled: boolean) => void;
}

const DrawerContext = createContext<DrawerContextValue>({
  isOpen: false,
  swipeEnabled: true,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  setSwipeEnabled: () => {},
});

export const DrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  const openDrawer = useCallback(() => setIsOpen(true), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const toggleDrawer = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <DrawerContext.Provider
      value={{ isOpen, swipeEnabled, openDrawer, closeDrawer, toggleDrawer, setSwipeEnabled }}
    >
      {children}
    </DrawerContext.Provider>
  );
};

export const useDrawer = () => useContext(DrawerContext);
export default DrawerContext;
