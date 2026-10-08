import re

with open('frontend/src/app/layout.tsx', 'r') as f:
    content = f.read()

analytics = """
import Script from "next/script";

"""

if 'import Script from "next/script";' not in content:
    content = content.replace('import "./globals.css";', 'import "./globals.css";\nimport Script from "next/script";')

ga_tags = """
      <head>
        {/* Google Analytics (I9) */}
        <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID || "G-XXXXXXXXXX"}`} />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || "G-XXXXXXXXXX"}', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body
"""

if '<head>' not in content:
    content = content.replace('<body', ga_tags.strip() + '\n      <body')

with open('frontend/src/app/layout.tsx', 'w') as f:
    f.write(content)
