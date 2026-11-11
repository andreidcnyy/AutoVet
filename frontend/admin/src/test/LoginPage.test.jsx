import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const post = vi.fn();
vi.mock("../api", () => ({ default: { post: (...args) => post(...args) } }));

const login = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login }) }));

import LoginPage from "../pages/LoginPage";
import { ThemeProvider } from "../context/ThemeContext";

const renderPage = () => render(<ThemeProvider><MemoryRouter><LoginPage /></MemoryRouter></ThemeProvider>);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function submit(email = "admin@autovet.com", password = "secret") {
  const user = userEvent.setup();
  renderPage();
  await user.type(screen.getByPlaceholderText("admin@digivet.com"), email);
  await user.type(screen.getByPlaceholderText("Enter your password"), password);
  await user.click(screen.getByRole("button", { name: /sign in|log in|login/i }));
}

describe("LoginPage (form validation and error messages)", () => {
  beforeEach(() => {
    post.mockReset();
    login.mockReset();
  });

  it("requires a valid email and a password before submitting", () => {
    renderPage();
    const email = screen.getByPlaceholderText("admin@digivet.com");
    const password = screen.getByPlaceholderText("Enter your password");

    expect(email).toBeRequired();
    expect(email).toHaveAttribute("type", "email");
    expect(password).toBeRequired();
  });

  it("logs the user in when the credentials are accepted", async () => {
    post.mockResolvedValue({ token: "abc", role: "clinic_admin" });
    await submit();

    expect(post).toHaveBeenCalledWith("/api/login", { email: "admin@autovet.com", password: "secret" });
    expect(login).toHaveBeenCalledWith({ token: "abc", role: "clinic_admin" });
  });

  it("says the password is wrong, not that the network failed", async () => {
    post.mockRejectedValue(httpError(401, "Invalid credentials."));
    await submit();

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the account is blocked", async () => {
    post.mockRejectedValue(httpError(403, "This account has been deactivated."));
    await submit();

    expect(await screen.findByText("This account has been deactivated.")).toBeInTheDocument();
  });

  it("tells the user the server is unreachable when there is no response", async () => {
    post.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();

    expect(await screen.findByText("Can't reach the server right now. Please try again in a moment.")).toBeInTheDocument();
  });
});
