import { useOutletContext } from "react-router-dom";
import ProfileView from "../components/profile/ProfileView";

function ProfilePage() {
    const { user, setUser } = useOutletContext();
    return <ProfileView user={user} setUser={setUser} />;
}

export default ProfilePage;
