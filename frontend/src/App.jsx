import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import {
  Camera,
  User,
  Shield,
  Check,
  X,
  Upload,
  Eye,
  Users,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

// const API_BASE_URL = "http://localhost:8000";
const API_BASE_URL = "https://catfish-teaching-notably.ngrok-free.app/api";

const FacialAuthApp = () => {
  const [activeTab, setActiveTab] = useState("enroll");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [enrolledUsers, setEnrolledUsers] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  // Enroll states
  const [userId, setUserId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Verify states
  const [event, setEvent] = useState("login-event");
  const [token, setToken] = useState("");
  const [verifyImage, setVerifyImage] = useState(null);
  const [verifyPreview, setVerifyPreview] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const fileInputRef = useRef(null);
  const verifyFileInputRef = useRef(null);
  const [useCamera, setUseCamera] = useState(false);
  const webcamRef = useRef(null);

  const events = [
    "login-event",
    "transaction-event",
    "payment-event",
    "admin-event",
    "sensitive-operation",
  ];

  // Show notification
  const showNotification = useCallback((message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Fetch system health
  const fetchHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error("Failed to fetch health:", error);
    }
  };

  // Fetch enrolled users
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const data = await response.json();
      setEnrolledUsers(data.enrolled_users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchUsers();
  }, []);

  // Handle file selection
  const handleFileSelect = (file, isVerify = false) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showNotification("Image must be less than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (isVerify) {
        setVerifyImage(file);
        setVerifyPreview(e.target.result);
      } else {
        setSelectedFile(file);
        setPreviewUrl(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Enroll face
  const handleEnroll = async () => {
    if (!userId.trim()) {
      showNotification("Please enter a user ID", "error");
      return;
    }

    if (!selectedFile) {
      showNotification("Please select an image", "error");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      });

      // Create a new FormData for the actual request
      const actualFormData = new FormData();
      actualFormData.append("file", selectedFile);

      const actualResponse = await fetch(
        `${API_BASE_URL}/enroll?user_id=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          body: actualFormData,
        }
      );

      if (actualResponse.ok) {
        showNotification("Face enrolled successfully!", "success");
        setUserId("");
        setSelectedFile(null);
        setPreviewUrl(null);
        fetchUsers();
        fetchHealth();
      } else {
        const error = await actualResponse.json();
        showNotification(error.detail || "Enrollment failed", "error");
      }
    } catch (error) {
      showNotification("Network error during enrollment", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Verify face
  const handleVerify = async () => {
    if (!token.trim()) {
      showNotification("Please enter a JWT token", "error");
      return;
    }

    if (!verifyImage) {
      showNotification("Please select an image for verification", "error");
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);

    try {
      const base64Image = await fileToBase64(verifyImage);

      const response = await fetch(`${API_BASE_URL}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          token,
          facial_data: base64Image.split(",")[1], // Remove data URL prefix
        }),
      });

      const result = await response.json();
      setVerificationResult(result);

      if (result.success) {
        showNotification("Verification successful!", "success");
      } else {
        showNotification("Verification failed", "error");
      }
    } catch (error) {
      showNotification("Network error during verification", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userIdToDelete) => {
    if (
      !window.confirm(
        `Are you sure you want to delete face data for ${userIdToDelete}?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/enroll/${encodeURIComponent(userIdToDelete)}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        showNotification("User deleted successfully", "success");
        fetchUsers();
        fetchHealth();
      } else {
        const error = await response.json();
        showNotification(error.detail || "Failed to delete user", "error");
      }
    } catch (error) {
      showNotification("Network error during deletion", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-green-500"
              : notification.type === "error"
              ? "bg-red-500"
              : "bg-blue-500"
          } text-white`}
        >
          {notification.type === "success" ? (
            <CheckCircle size={20} />
          ) : notification.type === "error" ? (
            <AlertCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">FaceAuth</h1>
                <p className="text-gray-300 text-sm">
                  Facial Recognition Authentication
                </p>
              </div>
            </div>

            {systemHealth && (
              <div className="text-right">
                <div className="text-green-400 font-semibold">
                  System Healthy
                </div>
                <div className="text-gray-300 text-sm">
                  {systemHealth.enrolled_users} users enrolled
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-black/20 p-1 rounded-xl mb-8">
          {[
            { id: "enroll", label: "Enroll Face", icon: User },
            { id: "verify", label: "Verify Face", icon: Eye },
            { id: "users", label: "Manage Users", icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Enroll Tab */}
        {activeTab === "enroll" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <User className="w-5 h-5" />
                Enroll New Face
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter unique user identifier"
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Face Image
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-gray-400 text-sm">
                      Click to upload image
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                </div>

                <button
                  onClick={handleEnroll}
                  disabled={isLoading || !userId || !selectedFile}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? "Enrolling..." : "Enroll Face"}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg border border-white/20"
                  />
                  <div className="text-gray-300 text-sm">
                    <strong>User ID:</strong> {userId || "Not specified"}
                  </div>
                </div>
              ) : (
                <div className="h-64 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verify Tab */}
        {activeTab === "verify" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Verify Face
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Event Type
                  </label>
                  <select
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {events.map((evt) => (
                      <option key={evt} value={evt} className="bg-gray-800">
                        {evt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    JWT Token
                  </label>
                  <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter JWT token from your service"
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Verification Method
                  </label>
                  <button
                    onClick={() => {
                      setUseCamera(!useCamera);
                      setVerifyImage(null);
                      setVerifyPreview(null);
                    }}
                    className="mb-4 bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded"
                  >
                    {useCamera ? "Use File Upload" : "Use Camera"}
                  </button>

                  {useCamera ? (
                    <div className="flex flex-col items-center gap-3">
                      <Webcam
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "user" }}
                        className="w-full rounded-lg border border-white/20"
                      />
                      <button
                        onClick={async () => {
                          const screenshot = webcamRef.current.getScreenshot();
                          if (screenshot) {
                            const blob = await fetch(screenshot).then((r) =>
                              r.blob()
                            );
                            const file = new File([blob], "webcam.jpg", {
                              type: "image/jpeg",
                            });
                            handleFileSelect(file, true);
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                      >
                        Capture Image
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => verifyFileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-gray-400 text-sm">
                          Click to upload verification image
                        </span>
                      </div>
                      <input
                        ref={verifyFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleFileSelect(e.target.files[0], true)
                        }
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isLoading || !token || !verifyImage}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? "Verifying..." : "Verify Face"}
                </button>
              </div>
            </div>

            {/* Verification Result */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Verification Result
              </h3>

              {verifyPreview && (
                <img
                  src={verifyPreview}
                  alt="Verification"
                  className="w-full h-48 object-cover rounded-lg border border-white/20 mb-4"
                />
              )}

              {verificationResult ? (
                <div
                  className={`p-4 rounded-lg border ${
                    verificationResult.success
                      ? "bg-green-500/20 border-green-500/50 text-green-300"
                      : "bg-red-500/20 border-red-500/50 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {verificationResult.success ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                    <span className="font-semibold">
                      {verificationResult.success
                        ? "Verification Successful"
                        : "Verification Failed"}
                    </span>
                  </div>

                  <div className="text-sm space-y-1">
                    <div>
                      <strong>User ID:</strong> {verificationResult.user_id}
                    </div>
                    <div>
                      <strong>Event:</strong> {verificationResult.event}
                    </div>
                    <div>
                      <strong>Confidence:</strong>{" "}
                      {(verificationResult.confidence * 100).toFixed(1)}%
                    </div>
                    <div>
                      <strong>Message:</strong> {verificationResult.message}
                    </div>
                  </div>
                </div>
              ) : !verifyPreview ? (
                <div className="h-48 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                  <Shield className="w-12 h-12 text-gray-500" />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Enrolled Users ({enrolledUsers.length})
              </h2>
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>

            {enrolledUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No users enrolled yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {enrolledUsers.map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{user}</div>
                        <div className="text-gray-400 text-sm">
                          Face enrolled
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteUser(user)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacialAuthApp;
