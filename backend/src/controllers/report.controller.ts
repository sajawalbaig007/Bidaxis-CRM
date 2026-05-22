import { Request, Response } from "express";

import prisma from "../config/db";

export const getReports = async (
  req: Request,
  res: Response
) => {

  try {

    /* =========================================
       LEADS
    ========================================= */

    const leads =
      await prisma.lead.findMany({

        include: {
          csr: true,
        },
      });

    const totalLeads =
      leads.length;

    const completed =
      leads.filter(
        (lead) =>
          lead.status
            ?.toLowerCase() ===
          "completed"
      ).length;

    const pending =
      leads.filter(
        (lead) =>
          lead.status
            ?.toLowerCase() ===
          "pending"
      ).length;

    const important =
      leads.filter(
        (lead) =>
          lead.status
            ?.toLowerCase() ===
          "important"
      ).length;

    const interested =
      leads.filter(
        (lead) =>
          lead.status
            ?.toLowerCase() ===
          "interested"
      ).length;

    /* =========================================
       CSR PERFORMANCE
    ========================================= */

    const csrMap =
      new Map();

    leads.forEach((lead) => {

      const csrId =
        lead.csr?.id ||
        "unknown";

      const csrName =
        lead.csr?.name ||
        "Unknown";

      if (
        !csrMap.has(csrId)
      ) {

        csrMap.set(csrId, {

          id: csrId,

          name: csrName,

          totalLeads: 0,

          completed: 0,

          pending: 0,

          important: 0,
        });
      }

      const csr =
        csrMap.get(csrId);

      csr.totalLeads++;

      if (
        lead.status
          ?.toLowerCase() ===
        "completed"
      ) {

        csr.completed++;
      }

      if (
        lead.status
          ?.toLowerCase() ===
        "pending"
      ) {

        csr.pending++;
      }

      if (
        lead.status
          ?.toLowerCase() ===
        "important"
      ) {

        csr.important++;
      }

    });

    const csrPerformance =
      Array.from(
        csrMap.values()
      );

    /* =========================================
       REPORT FILES
    ========================================= */

    const reports =
      await prisma.report.findMany({

        orderBy: {
          createdAt: "desc",
        },
      });

    /* =========================================
       RESPONSE
    ========================================= */

    res.json({

      totalLeads,

      completed,

      pending,

      important,

      interested,

      csrPerformance,

      reports,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      message:
        "Failed to fetch reports",
    });
  }
};