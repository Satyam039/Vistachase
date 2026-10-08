/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://vistachase.com',
  generateRobotsTxt: true,
  exclude: ['/admin*', '/booking/*/voucher', '/account*', '/forgot-password', '/reset-password', '/review/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: '*',
        disallow: ['/admin', '/booking', '/account'],
      },
    ],
  },
};
