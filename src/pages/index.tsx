import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">
          Identity and Access Management for NestJS, <br />
          without the complexity.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/usage/quick-start">
            Get Started &rarr;
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description="Zero-leakage Ory Stack integration for NestJS">
      <HomepageHeader />
      
      <main>
        {/* Core Features Section */}
        <section className="section">
          <div className="container">
            <div className="row">
              <div className={clsx('col col--4')}>
                <div className="feature-card">
                  <Heading as="h3">Zero Leakage</Heading>
                  <p>
                    Confine Ory-specific logic to internal adapters. Your application 
                    code interacts only with stable, library-owned DTOs and services.
                  </p>
                </div>
              </div>
              <div className={clsx('col col--4')}>
                <div className="feature-card">
                  <Heading as="h3">Multi-Tenant</Heading>
                  <p>
                    Natively handle multiple isolated Ory projects from a single NestJS 
                    service with robust cross-tenant bleed defense.
                  </p>
                </div>
              </div>
              <div className={clsx('col col--4')}>
                <div className="feature-card">
                  <Heading as="h3">Secure by Default</Heading>
                  <p>
                    Global guards automatically secure every route. Use simple 
                    decorators to opt-out or enforce granular permissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Code Preview Section */}
        <section className="section section--alt">
          <div className="container">
            <Heading as="h2" className="section__title">
              Built for Modern NestJS
            </Heading>
            <div className="code-preview">
              <div className="code-preview__header">
                <div className="code-preview__dot" />
                <div className="code-preview__dot" />
                <div className="code-preview__dot" />
              </div>
              <CodeBlock language="typescript">
{`@Controller('orders')
export class OrderController {
  @Get(':id')
  @RequirePermission({
    namespace: 'orders',
    relation: 'view',
    object: (req) => \`orders:\${req.params.id}\`,
  })
  async getOrder(@Param('id') id: string, @CurrentUser() user: UkkiIdentity) {
    return this.service.findOrder(id, user.id);
  }
}`}
              </CodeBlock>
            </div>
          </div>
        </section>

        {/* Why ory-nestjs Section */}
        <section className="section">
          <div className="container">
            <div className="row">
              <div className="col col--10 col--offset-1">
                <Heading as="h2" className="section__title">Why Choose ory-nestjs?</Heading>
                <div className="row">
                  <div className="col col--6">
                    <Heading as="h4">Production Ready</Heading>
                    <p>
                      Built-in support for audit logging, health checks, and 
                      correlation tracking. ory-nestjs is designed for 
                      mission-critical applications.
                    </p>
                  </div>
                  <div className="col col--6">
                    <Heading as="h4">Developer Experience</Heading>
                    <p>
                      Stop fighting with complex security protocols. Use declarative 
                      decorators and typed services to implement IAM in minutes.
                    </p>
                  </div>
                  <div className="col col--6">
                    <Heading as="h4">Pluggable Caching</Heading>
                    <p>
                      Reduce latency and Ory load with built-in session caching. 
                      Support for in-memory and custom distributed backends.
                    </p>
                  </div>
                  <div className="col col--6">
                    <Heading as="h4">Deterministic Testing</Heading>
                    <p>
                      Ships with a comprehensive testing module that mocks Ory 
                      entirely, allowing for zero-network integration testing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
