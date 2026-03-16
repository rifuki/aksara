import axios from "axios";
import { API_URL } from "@/lib/env";

export const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
