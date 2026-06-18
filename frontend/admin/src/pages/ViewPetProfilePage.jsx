import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ViewPetProfile from "../components/pets/ViewPetProfile";
import { useAuth } from "../context/AuthContext";

function ViewPetProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [pet, setPet] = useState(null);
  const [error, setError] = useState(null);

  const fetchPet = () => {
    if (!user?.token || !id) return;

    fetch(`/api/pets/${id}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${user.token}`
      }
    })
      .then((res) => {
        if (!res.ok) {
          console.error("Pet fetch failed with status:", res.status);
          throw new Error("Failed to load pet. Error code: " + res.status);
        }
        return res.json();
      })
      .then((data) => {
        setPet(data);
      })
      .catch((err) => {
        console.error("Error loading pet:", err);
        setError(err.message);
      });
  };

  useEffect(() => {
    fetchPet();

    const onVisible = () => { if (document.visibilityState === 'visible') fetchPet(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, user?.token]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-rose-500">
        {error}
      </div>
    );
  }

  return <ViewPetProfile pet={pet} onRefresh={fetchPet} />;
}

export default ViewPetProfilePage;
