import {
  Request,
  Response,
} from "express";

import XLSX from "xlsx";

import prisma from "../config/db";

import cloudinary from "../config/cloudinary";

type ExcelRow = {

  name?: string;
  Name?: string;

  company?: string;
  Company?: string;

  phone?: string | number;
  Phone?: string | number;

  mobile?: string | number;
  Mobile?: string | number;

  email?: string;
  Email?: string;

  address?: string;
  Address?: string;

  [key: string]: any;
};

/* ================= UPLOAD LEADS ================= */

export const uploadLeads =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      /* ================= CHECK FILE ================= */

      if (!req.file) {

        return res.status(400).json({

          success: false,

          message:
            "No file uploaded",
        });
      }

      /* ================= GET SELECTED CSRS ================= */

      const selectedCSRs =
        req.body.selectedCSRs
          ? JSON.parse(
              req.body.selectedCSRs
            )
          : [];

      /* ================= GET ADMIN ================= */

      const uploadedBy =
        "admin";

      /* ================= UPLOAD TO CLOUDINARY ================= */

      const uploaded =
        await new Promise<{
          secure_url: string;
        }>(
          (
            resolve,
            reject
          ) => {

            cloudinary.uploader
              .upload_stream(
                {
                  resource_type:
                    "raw",

                  folder:
                    "crm_uploads",
                },

                (
                  error,
                  result
                ) => {

                  if (
                    error ||
                    !result
                  ) {

                    reject(
                      error
                    );
                  }

                  else {

                    resolve({
                      secure_url:
                        result.secure_url,
                    });
                  }
                }
              )
              .end(
                req.file!.buffer
              );
          }
        );

      /* ================= READ EXCEL ================= */

      const workbook =
        XLSX.read(
          req.file.buffer,
          {
            type:
              "buffer",
          }
        );

      const sheetName =
        workbook
          .SheetNames[0];

      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      const data =
        XLSX.utils.sheet_to_json<ExcelRow>(
          worksheet
        );

      /* ================= GET ACTIVE CSRS ================= */

      const csrs =
        await prisma.user.findMany({

          where: {

            role: "csr",

            isActive: true,

            ...(selectedCSRs.length > 0 && {

              id: {
                in: selectedCSRs,
              },
            }),
          },

          select: {

            id: true,

            name: true,

            email: true,
          },
        });

      if (
        csrs.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "No active CSR users found",
        });
      }

      /* ================= SAVE FILE ================= */

      const uploadedFile =
        await prisma.uploadFile.create({

          data: {

            fileName:
              req.file
                .originalname,

            cloudinaryUrl:
              uploaded.secure_url,

            totalLeads:
              data.length,

            uploadedBy,
          },
        });

      /* ================= DISTRIBUTION ================= */

      const distributionMap:
        Record<
          string,
          number
        > = {};

      const createdLeads =
        [];

      /* ================= LOOP ROWS ================= */

      for (
        let i = 0;
        i < data.length;
        i++
      ) {

        const row =
          data[i];

        const csr =
          csrs[
            i %
              csrs.length
          ];

        /* ================= SMART FIELD DETECTION ================= */

        const keys =
          Object.keys(row);

        const findValue =
          (
            possibleKeys: string[]
          ) => {

            const foundKey =
              keys.find(
                (key) =>

                  possibleKeys.some(
                    (possible) =>

                      key
                        .toLowerCase()
                        .includes(
                          possible.toLowerCase()
                        )
                  )
              );

            return foundKey
              ? row[
                  foundKey
                ]
              : "";
          };

        /* ================= EXTRACT VALUES ================= */

        const finalName =
          String(
            findValue([
              "name",
              "client",
              "customer",
              "contact person",
            ])
          ).trim();

        const finalCompany =
          String(
            findValue([
              "company",
              "business",
              "organization",
              "address",
            ])
          ).trim();

        const finalPhone =
          String(
            findValue([
              "phone",
              "mobile",
              "cell",
              "contact",
              "telephone",
              "number",
            ])
          ).trim();

        const finalEmail =
          String(
            findValue([
              "email",
              "mail",
              "e-mail",
            ])
          ).trim();

        /* ================= CREATE LEAD ================= */

        const lead =
          await prisma.lead.create({

            data: {

              name:
                finalName,

              company:
                finalCompany,

              phone:
                finalPhone,

              email:
                finalEmail,

              assignedTo:
                csr.id,

              uploadedFileId:
                uploadedFile.id,
            },
          });

        createdLeads.push(
          lead
        );

        if (
          !distributionMap[
            csr.name
          ]
        ) {

          distributionMap[
            csr.name
          ] = 0;
        }

        distributionMap[
          csr.name
        ] += 1;
      }

      /* ================= FINAL DISTRIBUTION ================= */

      const distribution =
        Object.entries(
          distributionMap
        ).map(
          ([
            name,
            leads,
          ]) => ({

            name,

            leads,
          })
        );

      /* ================= RESPONSE ================= */

      return res.json({

        success: true,

        totalLeads:
          createdLeads.length,

        cloudinaryUrl:
          uploaded.secure_url,

        file:
          uploadedFile,

        distribution,
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({

        success: false,

        message:
          "Upload failed",
      });
    }
  };

/* ================= GET LATEST UPLOAD ================= */

export const getLatestUpload =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const latestFile =
        await prisma.uploadFile.findFirst({

          orderBy: {
            createdAt:
              "desc",
          },

          include: {

            leads: {

              include: {

                csr: {

                  select: {

                    id: true,

                    name: true,

                    email: true,
                  },
                },
              },
            },
          },
        });

      if (
        !latestFile
      ) {

        return res.json({

          success: true,

          file: null,
        });
      }

      const distributionMap:
        Record<
          string,
          number
        > = {};

      latestFile.leads.forEach(
        (
          lead
        ) => {

          const csrName =
            lead.csr.name;

          if (
            !distributionMap[
              csrName
            ]
          ) {

            distributionMap[
              csrName
            ] = 0;
          }

          distributionMap[
            csrName
          ] += 1;
        }
      );

      const distribution =
        Object.entries(
          distributionMap
        ).map(
          ([
            name,
            leads,
          ]) => ({

            name,

            leads,
          })
        );

      return res.json({

        success: true,

        file: {

          id:
            latestFile.id,

          fileName:
            latestFile.fileName,

          totalLeads:
            latestFile.totalLeads,

          cloudinaryUrl:
            latestFile.cloudinaryUrl,

          createdAt:
            latestFile.createdAt,

          distribution,
        },
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({

        success: false,

        message:
          "Failed to fetch latest upload",
      });
    }
  };