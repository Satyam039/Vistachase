/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://vistachase.com',
  generateRobotsTxt: true,
  exclude: ['/admin*', '/booking/*/voucher', '/account*'],
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
