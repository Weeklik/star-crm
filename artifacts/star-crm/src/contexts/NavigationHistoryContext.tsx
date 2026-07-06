import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

interface NavHistoryCtx {
  canGoBack: boolean;
  goBack: () => void;
}

const NavHistoryContext = createContext<NavHistoryCtx>({
  canGoBack: false,
  goBack: () => {},
});

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const stackRef = useRef<string[]>([location]);
  const [canGoBack, setCanGoBack] = useState(false);
  const suppressRef = useRef(false);

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const stack = stackRef.current;
    const top = stack[stack.length - 1];
    const bare = location.split("?")[0];
    if (top !== bare) {
      stack.push(bare);
      setCanGoBack(stack.length > 1);
    }
  }, [location]);

  const goBack = () => {
    const stack = stackRef.current;
    if (stack.length <= 1) return;
    stack.pop();
    const prev = stack[stack.length - 1];
    suppressRef.current = true;
    navigate(prev);
    setCanGoBack(stack.length > 1);
  };

  return (
    <NavHistoryContext.Provider value={{ canGoBack, goBack }}>
      {children}
    </NavHistoryContext.Provider>
  );
}

export const useNavigationHistory = () => useContext(NavHistoryContext);
