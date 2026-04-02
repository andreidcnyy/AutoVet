import { useState, useRef, useEffect } from "react";
import { FiCamera, FiSave, FiUser } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { getUserAvatarUrl } from "../../utils/userImages";
import { ROLES } from "../../constants/roles";

const profileSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    role: z.string().max(255).optional(),
    email: z.string().min(1, "Email is required").email("Invalid email address").max(255),
    avatar: z.string().optional()
});

function ProfileView({ user, setUser }) {
    const toast = useToast();
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: "",
            role: "",
            email: "",
            avatar: ""
        }
    });

    const avatarValue = watch("avatar");
    const nameValue = watch("name");
    const roleValue = watch("role");

    useEffect(() => {
        if (!user?.token) return;

        fetch("/api/profile", {
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${user.token}`
            }
        })
            .then(res => {
                if (res.status === 401) throw new Error("Authentication failed. Please log in again.");
                if (!res.ok) throw new Error("Backend server returned an error.");
                return res.json();
            })
            .then(data => {
                if (data && !data.error) {
                    reset({
                        name: data.name || "",
                        role: data.role || "",
                        email: data.email || "",
                        avatar: data.avatar || ""
                    });
                } else if (data.error) {
                    setFetchError(data.error);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Error fetching profile", err);
                setFetchError(err.message === "Authentication failed. Please log in again." 
                    ? err.message 
                    : "Could not load profile data. Please check your connection or ensure MySQL is running.");
                setIsLoading(false);
            });
    }, [user?.token, reset]);

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setValue("avatar", base64String, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    };

    const onSubmit = (data) => {
        return fetch("/api/profile", {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${user?.token}`
            },
            body: JSON.stringify(data)
        })
            .then(async res => {
                if (res.status === 401) throw new Error("Unauthorized. Please log in again.");
                const response = await res.json();
                if (res.ok && (response.status === "success" || response.message)) {
                    toast.success("Profile saved successfully!");
                    if (response.user && setUser) {
                        setUser(response.user);
                        // Also update localStorage as AuthContext does on login
                        localStorage.setItem("user", JSON.stringify(response.user));
                    }
                } else if (!res.ok && response.errors) {
                    toast.error(Object.values(response.errors)[0][0]);
                } else {
                    toast.error(response.error || "Error saving profile");
                }
            })
            .catch(err => toast.error("Error saving profile: " + err.message));
    };

    if (isLoading) {
        return <div className="p-10 text-center text-slate-500 text-lg">Loading Profile Data...</div>;
    }

    if (fetchError) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">My Profile</h2>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20">
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">Failed to load profile data</p>
                    <p className="mt-2 text-red-500 dark:text-red-300">{fetchError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">My Profile</h2>
                <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">Manage your personal clinic information and avatar.</p>
            </div>

            <section className="card-shell p-6">
                <h3 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-zinc-50">
                    <FiUser className="h-6 w-6 text-blue-600" />
                    Personal Details
                </h3>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 md:flex-row md:items-start">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group overflow-hidden rounded-full">
                            <img src={avatarValue || getUserAvatarUrl(roleValue, nameValue)} alt="Avatar" className="h-32 w-32 object-cover shadow-sm transition group-hover:blur-sm bg-slate-100 dark:bg-dark-surface" />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <FiCamera className="h-8 w-8 text-white" />
                                <span className="mt-1 text-xs font-semibold text-white">Change</span>
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            aria-label="Upload profile picture"
                        />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Full Name *</label>
                                <input
                                    {...register("name")}
                                    className={clsx(
                                        "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800",
                                        errors.name ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500"
                                    )}
                                    placeholder="e.g. Dr. Sarah Jenkins"
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Role</label>
                                <select
                                    {...register("role")}
                                    className={clsx(
                                        "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800",
                                        errors.role ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500"
                                    )}
                                >
                                    <option value="">Select Role</option>
                                    <option value={ROLES.ADMIN}>Administrator</option>
                                    <option value={ROLES.VETERINARIAN}>Veterinarian</option>
                                    <option value={ROLES.STAFF}>Staff</option>
                                </select>
                                {errors.role && <p className="mt-1 text-sm text-red-500">{errors.role.message}</p>}
                            </div>
                            <div className="lg:col-span-2">
                                <label className="mb-1 block text-sm font-semibold text-slate-600 dark:text-zinc-300">Email Address *</label>
                                <input
                                    {...register("email")}
                                    type="email"
                                    className={clsx(
                                        "h-12 w-full rounded-xl border bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:focus:bg-gray-800",
                                        errors.email ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-slate-200 focus:border-blue-300 dark:border-dark-border dark:focus:border-blue-500"
                                    )}
                                    placeholder="vet@example.com"
                                />
                                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                <FiSave className="h-4 w-4" />
                                {isSubmitting ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default ProfileView;
