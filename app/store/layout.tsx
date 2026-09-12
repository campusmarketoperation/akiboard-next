import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗管理画面",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
