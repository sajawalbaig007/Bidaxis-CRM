import { notFound } from "next/navigation";
import { parseCompanyParam } from "@/lib/companyGate";
import CompanyAccessClient from "./CompanyAccessClient";

type Props = { params: Promise<{ company: string }> };

export default async function CompanyAccessPage({ params }: Props) {
  const { company: raw } = await params;
  const company = parseCompanyParam(raw);
  if (!company) notFound();
  return <CompanyAccessClient company={company} />;
}

export function generateStaticParams() {
  return [{ company: "bem" }, { company: "gps" }];
}
