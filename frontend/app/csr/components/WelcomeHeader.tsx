"use client";

import {
  useEffect,
  useState,
} from "react";

import API from "@/lib/api";

export default function WelcomeHeader() {

  const [userName, setUserName] =
    useState("");

  useEffect(() => {

    const fetchUser =
      async () => {

        try {

          const res =
            await API.get(
              "/auth/me"
            );

          console.log(
            res.data
          );

          if (
            res.data?.success
          ) {

            setUserName(
              res.data.user.name
            );
          }

        } catch (error) {

          console.log(
            "Failed",
            error
          );
        }
      };

    fetchUser();

  }, []);

  return (
    <div className="mt-1">

      <h1 className="text-4xl font-bold text-[#0F172A]">

        Welcome back,{" "}

        <span className="text-[#B8112D]">

          {userName || "CSR"}

        </span>

        !

      </h1>

      <p className="text-gray-500 mt-2">

        Here's your calls,
        projects and important leads.

      </p>

    </div>
  );
}