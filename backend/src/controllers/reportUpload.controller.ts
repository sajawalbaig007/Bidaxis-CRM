import { Response } from "express";

import prisma from "../config/db";

import cloudinary from "../config/cloudinary";

import streamifier from "streamifier";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

export const uploadReport =
  async (
    req: AuthRequest & {
      file?: Express.Multer.File;
    },
    res: Response
  ) => {

    try {

      const file =
        req.file;

      if (!file) {

        return res.status(400).json({
          success: false,
          message:
            "No file uploaded",
        });
      }

      if (!req.user?.id) {

        return res.status(401).json({
          success: false,
          message:
            "Unauthorized",
        });
      }

      /* =========================================
         CLOUDINARY UPLOAD
      ========================================= */

      const uploaded =
        await new Promise<any>(
          (
            resolve,
            reject
          ) => {

            const stream =
              cloudinary.uploader.upload_stream(
                {
                  folder:
                    "reports",

                  resource_type:
                    "auto",
                },

                (
                  error,
                  result
                ) => {

                  if (error) {

                    reject(error);

                  } else {

                    resolve(result);
                  }
                }
              );

            streamifier
              .createReadStream(
                file.buffer
              )
              .pipe(stream);
          }
        );

      /* =========================================
         SAVE REPORT IN DATABASE
      ========================================= */

      const report =
        await prisma.report.create({
          data: {

            reportName:
              file.originalname,

            reportUrl:
              uploaded.secure_url,

            reportType:
              file.mimetype,

            generatedBy:
              req.user.id,
          },
        });

      return res.status(201).json({
        success: true,

        message:
          "Report uploaded successfully",

        report,
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({
        success: false,

        message:
          "Failed to upload report",
      });
    }
  };