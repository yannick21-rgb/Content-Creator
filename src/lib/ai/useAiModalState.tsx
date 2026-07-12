import { useState, useCallback, useEffect } from "react";

export function useAiModalState() {
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState("");

  const openAiModal = () => setShowAiModal(true);
  const closeAiModal = () => setShowAiModal(false);

  const handleGenerateWithAi = (content: string) => {
    setAiText(content);
    openAiModal();
  };

  const handleImproveWithAi = (content: string) => {
    setAiText(content);
    openAiModal();
  };

  useEffect(() => {
    if (!showAiModal) {
      setAiText("");
    }
  }, [showAiModal]);

  return {
    showAiModal,
    openAiModal,
    closeAiModal,
    handleGenerateWithAi,
    handleImproveWithAi,
    aiText,
    setAiText,
  };
}
