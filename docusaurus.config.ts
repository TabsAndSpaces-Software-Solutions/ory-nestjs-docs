import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'ory-nestjs',
  tagline: 'The Identity & Access Management framework for NestJS, built on Ory.',
  favicon: 'img/logo.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://orynestjs.tabsandspaces.co/',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Tabs And Spaces Software Solutions', // Usually your GitHub org/user name.
  projectName: 'ory-nestjs', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/logo.svg',
    announcementBar: {
      id: 'support_us',
      content:
        '<b>ory-nestjs</b> is now live on <a href="https://www.npmjs.com/package/ory-nestjs" target="_blank" rel="noopener">npm</a> — <code>pnpm add ory-nestjs</code>.',
      backgroundColor: '#000',
      textColor: '#fff',
      isCloseable: true,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ory-nestjs',
      logo: {
        alt: 'ory-nestjs Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'usageSidebar',
          position: 'left',
          label: 'Usage',
        },
        {
          type: 'docSidebar',
          sidebarId: 'developmentSidebar',
          position: 'left',
          label: 'Development',
        },
        {
          href: 'https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-example',
          label: 'Example',
          position: 'right',
        },
        {
          href: 'https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Quick Start',
              to: '/docs/usage/quick-start',
            },
            {
              label: 'Core Concepts',
              to: '/docs/usage/module-registration',
            },
            {
              label: 'API Reference',
              to: '/docs/usage/services',
            },
          ],
        },
        {
          title: 'Development',
          items: [
            {
              label: 'Architecture',
              to: '/docs/development/architecture',
            },
            {
              label: 'Contribution Guide',
              to: '/docs/development/contributing',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs',
            },
            {
              label: 'Example App',
              href: 'https://github.com/TabsAndSpaces-Software-Solutions/ory-nestjs-example',
            },
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/ory-nestjs',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Tabs And Spaces Software Solutions. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
