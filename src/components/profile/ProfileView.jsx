import { useState, useRef, useEffect } from "react";
import { FiCamera, FiSave, FiUser } from "react-icons/fi";

function ProfileView() {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [user, setUser] = useState({
        name: "",
        role: "",
        email: "",
        avatar: ""
    });

    useEffect(() => {
        fetch("/api/profile")
            .then(res => {
                if (!res.ok) throw new Error("Backend server returned an error.");
                return res.json();
            })
            .then(data => {
                if (data && !data.error) {
                    setUser({
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
                setFetchError("Could not connect to the database or backend server. Please ensure MySQL is running.");
                setIsLoading(false);
            });
    }, []);

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setUser((prev) => ({ ...prev, avatar: base64String }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    alert("Profile saved successfully to database!");
                } else {
                    alert("Error saving profile: " + JSON.stringify(data));
                }
            })
            .catch(err => alert("Network error saving profile: " + err.message));
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
                <h2 className="text-4xl font-bold tracking-tight text-slate-900">My Profile</h2>
                <p className="mt-1 text-base text-slate-500">Manage your personal clinic information and avatar.</p>
            </div>

            <section className="card-shell p-6">
                <h3 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <FiUser className="h-6 w-6 text-blue-600" />
                    Personal Details
                </h3>

                <div className="flex flex-col gap-8 md:flex-row md:items-start">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group overflow-hidden rounded-full">
                            <img src={user.avatar} alt={user.name} className="h-32 w-32 object-cover shadow-sm transition group-hover:blur-sm" />
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
                                <label className="mb-1 block text-sm font-semibold text-slate-600">Full Name</label>
                                <input
                                    value={user.name}
                                    onChange={(e) => setUser({ ...user, name: e.target.value })}
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none"
                                    placeholder="e.g. Dr. Sarah Jenkins"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600">Role</label>
                                <input
                                    value={user.role}
                                    onChange={(e) => setUser({ ...user, role: e.target.value })}
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none"
                                    placeholder="e.g. Chief Veterinarian"
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <label className="mb-1 block text-sm font-semibold text-slate-600">Email Address</label>
                                <input
                                    value={user.email}
                                    onChange={(e) => setUser({ ...user, email: e.target.value })}
                                    type="email"
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none"
                                    placeholder="vet@example.com"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleSave}
                                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <FiSave className="h-4 w-4" />
                                Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default ProfileView;
