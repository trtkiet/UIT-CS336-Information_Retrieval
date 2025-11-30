import torch
import torch.nn.functional as F
import open_clip
import logging
import config
import numpy as np

logger = logging.getLogger(__name__)

class TextEncoder:
    def __init__(self, device: str = 'cuda'):
        self.device = device
        logger.info(f"Loading model '{config.CLIP_MODEL_NAME}' to device '{self.device}'...")
        self.model, _, _ = open_clip.create_model_and_transforms(
            config.CLIP_MODEL_NAME,
            pretrained=config.CLIP_PRETRAINED
        )
        
        del self.model.visual
        
        self.model = self.model.to(self.device)
        self.model.eval()
        self.tokenizer = open_clip.get_tokenizer(config.CLIP_MODEL_NAME)
        
        # Precompute common query tokens for performance
        # Common query cache for performance
        self.common_queries = ["person", "car", "building"]
        
        self.precomputed_tokens = {
            query: self.tokenizer([query]).to(self.device)
            for query in self.common_queries
        }
        logger.info("TextEncoder initialized successfully.")

    def encode(self, query: str):
        text_inputs = self.tokenizer([query]).to(self.device)

        with torch.no_grad():
            text_features = self.model.encode_text(text_inputs)
            return F.normalize(text_features.cpu(), p=2, dim=-1).detach().numpy().astype(np.float32)