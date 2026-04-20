import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  usageSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'usage/quick-start',
        'usage/installation',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'usage/module-registration',
        'usage/authentication',
        'usage/authorization',
        'usage/multi-tenancy',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'usage/services',
        'usage/caching',
        'usage/audit-observability',
        'usage/error-model',
        'usage/self-service-flows',
        'usage/testing',
      ],
    },
    {
      type: 'category',
      label: 'Scenarios',
      items: [
        'usage/scenario-a',
        'usage/scenario-b',
        'usage/scenario-c',
      ],
    },
    'mcp-server',
  ],
  developmentSidebar: [
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'development/architecture',
        'development/decisions',
        'development/workflow',
        'development/contributing',
        'mcp-server',
      ],
    },
  ],
};

export default sidebars;
