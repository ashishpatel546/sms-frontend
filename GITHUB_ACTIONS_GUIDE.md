# GitHub Actions Guide for School Frontend

This document explains how to set up GitHub Actions for automated deployment of the `sms-frontend` application. Because the platform operates as a multi-tenant system (where each school has its own custom PWA branding, logos, and environment configurations), deployments leverage **GitHub Environments** to securely inject variables during the build and deployment process.

---

## 1. Required Variables & Secrets

You must configure these settings in your repository. To do this, go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.

### 🌍 Repository-Level Variables
These values apply universally across all schools and should be added under **Repository variables**.

| Name | Example Value | Description |
|------|--------------|-------------|
| `COLEGIO_HUB_API_URL` | `https://hub-api.colegios.in` | The base URL of your central Hub API. Used during the prebuild script to fetch school logos. |

### 🏢 Environment-Level Variables
Because each school represents a separate tenant, you must create a separate **GitHub Environment** for each school (e.g., `production-dps`, `production-bgs`).

Go to **Settings** -> **Environments** -> **New environment**. Inside that specific environment, define the following:

#### Environment Variables
| Name | Example Value | Description |
|------|--------------|-------------|
| `SCHOOL_SLUG` | `dps` | The unique slug identifier for the school. |
| `NEXT_PUBLIC_SCHOOL_SLUG` | `dps` | The public identifier for Next.js to use internally (e.g., for PWA icons fallback). |
| `NEXT_PUBLIC_API_URL` | `https://api.dps.colegios.in` | The dedicated API URL (`sms-backend`) for this specific school. |

#### Environment Secrets
| Name | Example | Description |
|------|---------|-------------|
| `COLEGIO_SERVICE_TOKEN` | `ey...` | The secure CI/CD service token generated from the Hub Admin panel. This allows the GitHub Action to authenticate and download the school's logo securely. |

---

## 2. GitHub Actions Workflow

A pre-configured GitHub Actions workflow file has been included at `.github/workflows/deploy-frontend.yml`. 

This workflow uses a `workflow_dispatch` trigger, meaning you can manually trigger deployments from the GitHub UI and select which school's environment to deploy.

### How to Trigger a Deployment

1. Navigate to the **Actions** tab in your GitHub repository.
2. Under "All workflows" on the left sidebar, click **Deploy School Frontend**.
3. On the right side, click the **Run workflow** dropdown.
4. Select or type the **Target GitHub Environment** (e.g., `production-dps`) that perfectly matches the environment you created in Settings.
5. Click **Run workflow**.

### What happens during the workflow?
When the workflow runs, it automatically:
- Checks out the repository code.
- Injects the `COLEGIO_SERVICE_TOKEN` securely alongside your other environment variables.
- Executes `npm run build` which triggers the `prebuild` hook (`fetch-logo-and-icons.mjs`).
- Downloads the logo from the Hub API and dynamically regenerates the PWA icons.
- Packages the fully branded Next.js frontend, ready to be deployed to Vercel/AWS/Docker.

*(Note: Depending on your hosting provider—like Vercel, AWS ECS, or Docker—you can customize the final "Deploy to Production" step in the `.github/workflows/deploy-frontend.yml` file.)*