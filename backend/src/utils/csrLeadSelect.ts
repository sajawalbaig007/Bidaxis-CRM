import { CSR_UPLOAD_FILE_SELECT } from "./uploadSourceSelect";

/** Lean lead payload for CSR dashboard / list views — notes loaded on demand */
export const CSR_DASHBOARD_LEAD_SELECT = {
  id:                 true,
  name:               true,
  company:            true,
  phone:              true,
  email:              true,
  status:             true,
  nextSchedule:       true,
  nextTime:           true,
  timezone:           true,
  followUpNotes:      true,
  interestedService:  true,
  comments:           true,
  state:              true,
  hiddenOnMain:       true,
  important:          true,
  interested:         true,
  inBin:              true,
  notPickedCount:     true,
  notInterestedCount: true,
  updatedAt:          true,
  createdAt:          true,
  uploadFile:         { select: CSR_UPLOAD_FILE_SELECT },
  _count:             { select: { notes: true } },
} as const;
