import type { AppType } from "next/dist/shared/lib/utils";
import { Geist } from "next/font/google";
import { ThemeProvider } from "~/contexts/ThemeContext";

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ThemeProvider>
      <div className={geist.className}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
};

export default MyApp;
