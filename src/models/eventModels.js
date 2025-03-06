import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  userName: { type: String },
  userID: { type: String },
  userEmail: { type: String },
  userTel: { type: String },
  userCpf: { type: String },
  userProced: { type: String },
  userComoNosConheceu: { type: String },
  userNascimento: { type: Date },
});

const Event = mongoose.model('Event', eventSchema);
export default Event;
