// Aggregates the bn namespaces. Add a namespace by creating <ns>.json in en/, hi/ and bn/ and listing it in all three.
import activities from './activities.json';
import admin from './admin.json';
import ai from './ai.json';
import assistant from './assistant.json';
import attendance from './attendance.json';
import auth from './auth.json';
import circulars from './circulars.json';
import classes from './classes.json';
import common from './common.json';
import dashboard from './dashboard.json';
import exams from './exams.json';
import fees from './fees.json';
import homework from './homework.json';
import hr from './hr.json';
import idCards from './idCards.json';
import inventory from './inventory.json';
import leaves from './leaves.json';
import library from './library.json';
import nav from './nav.json';
import notifications from './notifications.json';
import parent from './parent.json';
import pickup from './pickup.json';
import product from './product.json';
import profile from './profile.json';
import publicPages from './publicPages.json';
import reports from './reports.json';
import settings from './settings.json';
import splash from './splash.json';
import staff from './staff.json';
import students from './students.json';
import subjects from './subjects.json';
import support from './support.json';
import ui from './ui.json';
import visitors from './visitors.json';
import type { Messages } from '../en';

// `satisfies` makes tsc fail when a key in en/ has no translation here.
const messages = {
  activities,
  admin,
  ai,
  assistant,
  attendance,
  auth,
  circulars,
  classes,
  common,
  dashboard,
  exams,
  fees,
  homework,
  hr,
  idCards,
  inventory,
  leaves,
  library,
  nav,
  notifications,
  parent,
  pickup,
  product,
  profile,
  publicPages,
  reports,
  settings,
  splash,
  staff,
  students,
  subjects,
  support,
  ui,
  visitors,
} satisfies Messages;
export default messages;
