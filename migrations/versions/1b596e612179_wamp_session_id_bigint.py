"""wamp_session_id_bigint

Revision ID: 1b596e612179
Revises: 51c799adcfb1
Create Date: 2015-08-12 21:10:43.274470

"""

# revision identifiers, used by Alembic.
revision = '1b596e612179'
down_revision = '51c799adcfb1'

from alembic import op
import sqlalchemy as sa


def upgrade():
	op.alter_column('wamp_session', 'sessionid', type_=sa.BigInteger(), existing_type=sa.Integer())


def downgrade():
	op.alter_column('wamp_session', 'sessionid', type_=sa.Integer(), existing_type=sa.BigInteger())
