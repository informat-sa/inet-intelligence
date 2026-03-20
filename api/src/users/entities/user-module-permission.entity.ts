import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_module_permissions')
@Unique(['userId', 'modulePrefix'])
export class UserModulePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (u) => u.modulePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 10 })
  modulePrefix: string;   // 'VFA', 'CCC', etc.

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  grantedAt: Date;
}
